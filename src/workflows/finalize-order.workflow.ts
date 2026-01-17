import { EsimRepository } from '../db/esim.repository';
import { OrderRepository } from '../db/order.repository';
import { SyncLogRepository } from '../db/sync-log.repository';

import { PdfService } from '../services/pdf-service';
import { logger } from '../utils/logger';

/* ======================================================
 * FINALIZE ORDER WORKFLOW (NO SMTP)
 * ====================================================== */

export class FinalizeOrderWorkflow {

    private readonly esimRepo = new EsimRepository();
    private readonly orderRepo = new OrderRepository();
    private readonly syncLogRepo = new SyncLogRepository();
    private readonly pdfService = new PdfService();

    private readonly TARGET_SERVICE = 'GLOBALTIX_PDF';

    /* ======================================================
     * RUN WORKFLOW
     * ====================================================== */

    async run(): Promise<void> {
        logger.info('[FINALIZE] Scanning eSIM READY');

        const esims =
            await this.esimRepo.findReadyForFinalize();

        if (esims.length === 0) {
            logger.info('[FINALIZE] No eSIM ready');
            return;
        }

        for (const esim of esims) {
            try {
                await this.processSingleEsim(esim);
            } catch (error) {
                logger.error('[FINALIZE] Fatal error', {
                    esimId: esim.id,
                    error
                });
            }
        }
    }

    /* ======================================================
     * PROCESS SINGLE ESIM
     * ====================================================== */

    private async processSingleEsim(esim: any): Promise<void> {

        /* --------------------------------------------------
         * LOCK (ANTI DOUBLE PROCESS)
         * -------------------------------------------------- */
        const locked =
            await this.esimRepo.markAsFinalizing(esim.id);

        if (!locked) {
            logger.warn('[FINALIZE] Skip locked eSIM', {
                esimId: esim.id
            });
            return;
        }

        const orderItem =
            await this.orderRepo.findItemById(
                esim.order_item_id
            );

        if (!orderItem) {
            logger.warn('[FINALIZE] Order item not found', {
                orderItemId: esim.order_item_id
            });

            await this.esimRepo.markAsFailed(esim.id);
            return;
        }

        const confirmationCode =
            orderItem.confirmation_code;

        const referenceNumber =
            orderItem.reference_number;

        /* --------------------------------------------------
         * IDEMPOTENCY CHECK (SUCCESS ONLY)
         * -------------------------------------------------- */
        const alreadySuccess =
            await this.syncLogRepo.isSuccess(
                confirmationCode,
                this.TARGET_SERVICE
            );

        if (alreadySuccess) {
            logger.info('[FINALIZE] Already finalized', {
                confirmationCode
            });

            await this.esimRepo.markAsDone(esim.id);
            await this.orderRepo.markItemCompleted(
                esim.order_item_id
            );
            return;
        }

        /* --------------------------------------------------
         * GENERATE PDF (DB = SOURCE OF TRUTH)
         * -------------------------------------------------- */
        logger.info('[FINALIZE] Generating PDF', {
            confirmationCode
        });

        try {
            const { pdfPath } =
                await this.pdfService.generatePdfByEsimId(
                    esim.id
                );

            /* ----------------------------------------------
             * SUCCESS
             * ---------------------------------------------- */
            await this.syncLogRepo.upsertLog({
                confirmationCode,
                referenceNumber,
                targetService: this.TARGET_SERVICE,
                requestPayload: { pdfPath },
                responsePayload: { file: pdfPath },
                status: 'SUCCESS'
            });

            await this.esimRepo.markAsDone(esim.id);
            await this.orderRepo.markItemCompleted(
                esim.order_item_id
            );

            logger.info('[FINALIZE] Completed', {
                confirmationCode
            });

        } catch (error: any) {

            /* ----------------------------------------------
             * FAILED (SAFE RETRY)
             * ---------------------------------------------- */
            await this.syncLogRepo.upsertLog({
                confirmationCode,
                referenceNumber,
                targetService: this.TARGET_SERVICE,
                requestPayload: {},
                status: 'FAILED',
                errorMessage: error?.message
            });

            await this.esimRepo.markAsFailed(esim.id);

            logger.error('[FINALIZE] PDF generation failed', {
                confirmationCode,
                error: error?.message
            });
        }
    }
}
