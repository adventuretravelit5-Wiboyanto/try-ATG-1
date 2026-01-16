import { EsimRepository } from '../db/esim.repository';
import { OrderRepository } from '../db/order.repository';
import { SyncLogRepository } from '../db/sync-log.repository';

import { PdfService } from '../services/pdf-service';
import { SmtpService } from '../services/smtp-service';

import { logger } from '../utils/logger';

/* ======================================================
 * FINALIZE ORDER WORKFLOW
 * ====================================================== */

export class FinalizeOrderWorkflow {

    private esimRepo = new EsimRepository();
    private orderRepo = new OrderRepository();
    private syncLogRepo = new SyncLogRepository();

    private pdfService = new PdfService();
    private smtpService = new SmtpService();

    /* ======================================================
     * RUN WORKFLOW
     * ====================================================== */
    async run(): Promise<void> {
        logger.info('[FINALIZE] Checking eSIM ready for finalization');

        const esims = await this.esimRepo.findReadyForFinalize();

        if (esims.length === 0) {
            logger.info('[FINALIZE] No eSIM ready');
            return;
        }

        for (const esim of esims) {
            await this.processSingleEsim(esim).catch(err => {
                logger.error(
                    '[FINALIZE] Failed',
                    { orderItemId: esim.order_item_id, err }
                );
            });
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
        const referenceNumber  = orderItem.reference_number;

        const targetService = 'GLOBALTIX_PDF';

        /* --------------------------------------------------
         * IDEMPOTENCY CHECK
         * -------------------------------------------------- */
        const alreadySent = await this.syncLogRepo.isAlreadySynced(
            confirmationCode,
            targetService
        );

        if (alreadySent) {
            logger.info('[FINALIZE] PDF already sent', { confirmationCode });

            await this.esimRepo.updateStatus(
                esim.order_item_id,
                'DONE'
            );
            return;
        }

        /* --------------------------------------------------
         * GENERATE PDF
         * -------------------------------------------------- */
        logger.info('[FINALIZE] Generating PDF', { confirmationCode });

        const pdfPath = await this.pdfService.generateEsimPdf({
            confirmationCode,
            referenceNumber,
            productName: esim.product_name,
            iccid: esim.iccid,
            qrCode: esim.qr_code,
            smdpAddress: esim.smdp_address,
            activationCode: esim.activation_code,
            combinedActivation: esim.combined_activation,
            apn: {
                name: esim.apn_name,
                username: esim.apn_username,
                password: esim.apn_password
            },
            validFrom: esim.valid_from,
            validUntil: esim.valid_until
        });

        /* --------------------------------------------------
         * SEND PDF
         * -------------------------------------------------- */
        logger.info('[FINALIZE] Sending PDF', { confirmationCode });

        try {
            const response = await this.smtpService.sendPdf({
                to: orderItem.customer_email,
                subject: `Your eSIM – ${confirmationCode}`,
                pdfPath
            });

            /* ----------------------------------------------
             * SUCCESS
             * ---------------------------------------------- */
            await this.syncLogRepo.upsertLog({
                confirmationCode,
                referenceNumber,
                targetService,
                requestPayload: { pdfPath },
                responsePayload: response,
                status: 'SUCCESS'
            });

            await this.esimRepo.markAsDone(
                esim.order_item_id
            );

            await this.orderRepo.markItemCompleted(
                esim.order_item_id
            );

            logger.info('[FINALIZE] Completed', { confirmationCode });

        } catch (err: any) {

            /* ----------------------------------------------
             * FAILED
             * ---------------------------------------------- */
            await this.syncLogRepo.upsertLog({
                confirmationCode,
                referenceNumber,
                targetService,
                requestPayload: { pdfPath },
                status: 'FAILED',
                errorMessage: err.message
            });

            logger.error('[FINALIZE] Send PDF failed', {
                confirmationCode,
                err
            });
        }
    }
}
