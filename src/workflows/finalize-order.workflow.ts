// src/workflows/finalize-order.workflow.ts

import { EsimRepository } from '../db/esim.repository';
import { OrderRepository } from '../db/order.repository';
import { SyncLogRepository } from '../db/sync-log.repository';
import { PdfService } from '../services/pdf-service';
import { logger } from '../utils/logger';

/* ======================================================
 * FINALIZE ORDER WORKFLOW
 * ====================================================== */

export class FinalizeOrderWorkflow {

    private readonly esimRepo = new EsimRepository();
    private readonly orderRepo = new OrderRepository();
    private readonly syncLogRepo = new SyncLogRepository();
    private readonly pdfService = new PdfService();

    /* ======================================================
     * RUN
     * ====================================================== */
    async run(): Promise<void> {
        logger.info('[FINALIZE] Scanning eSIM ready for finalize');

        const esims = await this.esimRepo.findDone();

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

        const orderItem =
            await this.orderRepo.findItemById(
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
        const targetService = 'GLOBALTIX_PDF';

        /* ==================================================
         * IDEMPOTENCY CHECK
         * ================================================== */
        const alreadySynced =
            await this.syncLogRepo.isAlreadySynced(
                confirmationCode,
                targetService
            );

        if (alreadySynced) {
            logger.info('[FINALIZE] Already finalized', {
                confirmationCode
            });

            await this.esimRepo.markAsDone(esim.id);
            await this.orderRepo.markItemCompleted(
                esim.order_item_id
            );
            return;
        }

        /* ==================================================
         * GENERATE PDF
         * ================================================== */
        logger.info('[FINALIZE] Generating PDF', {
            confirmationCode
        });

        const { pdfPath } =
            await this.pdfService.generatePdfByEsimId(
                esim.id
            );

        /* ==================================================
         * SAVE SYNC LOG (SUCCESS)
         * ================================================== */
        await this.syncLogRepo.upsertLog({
            confirmationCode,
            referenceNumber,
            targetService,
            requestPayload: { pdfPath },
            responsePayload: { stored: true },
            status: 'SUCCESS'
        });

        await this.esimRepo.markAsDone(esim.id);
        await this.orderRepo.markItemCompleted(
            esim.order_item_id
        );

        logger.info('[FINALIZE] Completed', {
            confirmationCode
        });
    }
}
