// src/workflows/finalize-order.workflow.ts

import { EsimRepository } from '../db/esim.repository';
import { OrderRepository } from '../db/order.repository';
import { SyncLogRepository } from '../db/sync-log.repository';
import { PdfService } from '../services/pdf-service';
import { GlobalTixUploadService } from '../services/globaltix-upload.service';
import { OTPService } from '../services/otp.service';
import { logger } from '../utils/logger';
import { env } from '../config/env';

/* ======================================================
 * FINALIZE ORDER WORKFLOW (WITH AUTO-UPLOAD & OTP)
 * ====================================================== */

export class FinalizeOrderWorkflow {

    private readonly esimRepo = new EsimRepository();
    private readonly orderRepo = new OrderRepository();
    private readonly syncLogRepo = new SyncLogRepository();
    private readonly pdfService = new PdfService();
    private readonly uploadService: GlobalTixUploadService;
    private readonly otpService = new OTPService();

    private readonly TARGET_SERVICE = 'GLOBALTIX_PDF';

    constructor() {
        // Initialize GlobalTix upload service
        this.uploadService = new GlobalTixUploadService({
            baseUrl: process.env.GLOBALTIX_UPLOAD_URL || 'https://mock-globaltix.com',
            apiKey: process.env.GLOBALTIX_API_KEY || 'mock_api_key'
        });
    }

    /* ======================================================
     * RUN
     * ====================================================== */
    async run(): Promise<void> {
        logger.info('[FINALIZE] Scanning eSIM ready for finalize');

        const esims = await this.esimRepo.findPendingUpload();

        if (esims.length === 0) {
            logger.info('[FINALIZE] No eSIM ready');
            return;
        }

        for (const esim of esims) {
            try {
                await this.processSingleEsim(esim);
            } catch (err) {
                logger.error('[FINALIZE] Fatal error', {
                    esimId: esim.id,
                    err
                });
            }
        }
    }

    /* ======================================================
     * PROCESS SINGLE ESIM
     * ====================================================== */
    private async processSingleEsim(esim: any): Promise<void> {

        const orderItem = await this.orderRepo.findItemById(
            esim.order_item_id
        );

        if (!orderItem) {
            logger.warn('[FINALIZE] Order item not found', {
                orderItemId: esim.order_item_id
            });
            return;
        }

        const confirmationCode = orderItem.confirmation_code;
        const referenceNumber = orderItem.reference_number;

        /* ==================================================
         * IDEMPOTENCY CHECK
         * ================================================== */
        const alreadySynced = await this.syncLogRepo.isAlreadySynced(
            confirmationCode,
            this.TARGET_SERVICE
        );

        if (alreadySynced) {
            logger.info('[FINALIZE] Already finalized', {
                confirmationCode
            });

            await this.esimRepo.markAsDone(esim.id);
            await this.orderRepo.markItemCompleted(esim.order_item_id);
            return;
        }

        /* ==================================================
         * GENERATE PDF
         * ================================================== */
        logger.info('[FINALIZE] Generating PDF', {
            confirmationCode
        });

        try {
            const { pdfPath } = await this.pdfService.generatePdfByEsimId(
                esim.id
            );

            /* ----------------------------------------------
             * 🆕 UPLOAD PDF TO GLOBALTIX
             * ---------------------------------------------- */
            logger.info('[FINALIZE] Uploading PDF to GlobalTix', {
                confirmationCode,
                pdfPath
            });

            const uploadResult = await this.uploadService.uploadPDF({
                confirmationCode,
                pdfFilePath: pdfPath,
                customerEmail: orderItem.customer_email || 'unknown@example.com',
                customerName: orderItem.customer_name || 'Unknown Customer'
            });

            if (!uploadResult.success) {
                throw new Error('PDF upload failed');
            }

            logger.info('[FINALIZE] ✅ PDF uploaded successfully', {
                confirmationCode,
                uploadUrl: uploadResult.uploadUrl
            });

            /* ----------------------------------------------
             * 🆕 GENERATE OTP FOR ADMIN CONFIRMATION
             * ---------------------------------------------- */
            const uploadOTP = await this.otpService.createUploadOTP({
                orderId: orderItem.order_id,
                orderItemId: esim.order_item_id,
                confirmationCode,
                pdfFilePath: pdfPath
            });

            logger.info('[FINALIZE] 🔐 OTP generated', {
                confirmationCode,
                otpCode: uploadOTP.otpCode
            });

            /* ----------------------------------------------
             * UPDATE ESIM WITH UPLOAD INFO
             * ---------------------------------------------- */
            await this.esimRepo.updatePdfUploadInfo(esim.id, {
                pdfFilePath: pdfPath,
                pdfUploadedAt: new Date()
            });

            /* ----------------------------------------------
             * SUCCESS LOG
             * ---------------------------------------------- */
            await this.syncLogRepo.upsertLog({
                confirmationCode,
                referenceNumber: referenceNumber || confirmationCode,
                targetService: this.TARGET_SERVICE,
                requestPayload: { pdfPath },
                responsePayload: {
                    file: pdfPath,
                    uploadUrl: uploadResult.uploadUrl,
                    uploadedAt: uploadResult.uploadedAt,
                    otpGenerated: true
                },
                status: 'SUCCESS'
            });

            /* ----------------------------------------------
             * STATUS: PENDING_CONFIRMATION (Wait for OTP)
             * ---------------------------------------------- */
            await this.esimRepo.updateStatus(esim.id, 'PENDING_CONFIRMATION');

            logger.info('[FINALIZE] ⏳ Waiting for admin OTP confirmation', {
                confirmationCode,
                otpCode: uploadOTP.otpCode
            });

        } catch (error: any) {

            /* ----------------------------------------------
             * FAILED (SAFE RETRY)
             * ---------------------------------------------- */
            await this.syncLogRepo.upsertLog({
                confirmationCode,
                referenceNumber: referenceNumber || confirmationCode,
                targetService: this.TARGET_SERVICE,
                requestPayload: {},
                status: 'FAILED',
                errorMessage: error?.message
            });

            await this.esimRepo.markFailed(esim.id);

            logger.error('[FINALIZE] PDF generation/upload failed', {
                confirmationCode,
                error: error?.message
            });
        }
    }
}
