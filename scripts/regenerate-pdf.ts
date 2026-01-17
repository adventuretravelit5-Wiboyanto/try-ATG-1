#!/usr/bin/env ts-node
import 'dotenv/config';

import { EsimRepository } from '../src/db/esim.repository';
import { OrderRepository } from '../src/db/order.repository';
import { PdfService } from '../src/services/pdf-service';
import { logger } from '../src/utils/logger';

/* ======================================================
 * CLI ARGUMENT
 * ======================================================
 * Usage:
 *   ts-node scripts/regenerate-pdf.ts CONFIRMATION_CODE
 *   ts-node scripts/regenerate-pdf.ts --all
 */

const args = process.argv.slice(2);
const target = args[0];

/* ======================================================
 * MAIN
 * ====================================================== */

async function regeneratePdf(): Promise<void> {
    logger.info('[REGENERATE PDF] Started');

    if (!target) {
        throw new Error(
            'Missing argument. Use CONFIRMATION_CODE or --all'
        );
    }

    const esimRepo = new EsimRepository();
    const orderRepo = new OrderRepository();
    const pdfService = new PdfService();

    let esims: any[] = [];

    /* ======================================================
     * MODE SELECTION
     * ====================================================== */

    if (target === '--all') {
        logger.info('[REGENERATE PDF] Mode: ALL DONE eSIM');

        esims = await esimRepo.findDone(); // ✅ METHOD NYATA

        if (esims.length === 0) {
            logger.warn('[REGENERATE PDF] No DONE eSIM found');
            return;
        }

    } else {
        logger.info('[REGENERATE PDF] Mode: SINGLE', {
            confirmationCode: target
        });

        const orderItem =
            await orderRepo.findItemByConfirmationCode(target);

        if (!orderItem) {
            throw new Error(
                `Order item not found: ${target}`
            );
        }

        const esim =
            await esimRepo.findByOrderItemId(orderItem.id);

        if (!esim) {
            throw new Error(
                `eSIM not found for confirmationCode: ${target}`
            );
        }

        esims = [esim];
    }

    /* ======================================================
     * PROCESS
     * ====================================================== */

    for (const esim of esims) {
        try {
            logger.info('[REGENERATE PDF] Generating PDF', {
                esimId: esim.id,
                iccid: esim.iccid
            });

            await pdfService.generatePdfByEsimId(
                esim.id,
                { force: true } // 🔥 overwrite existing PDF
            );

            logger.info('[REGENERATE PDF] Success', {
                esimId: esim.id
            });

        } catch (error: any) {
            logger.error('[REGENERATE PDF] Failed', {
                esimId: esim.id,
                error: error?.message
            });
        }
    }

    logger.info('[REGENERATE PDF] Finished');
}

/* ======================================================
 * EXECUTE
 * ====================================================== */

regeneratePdf()
    .then(() => process.exit(0))
    .catch((err) => {
        logger.error('[REGENERATE PDF] Fatal error', err);
        process.exit(1);
    });
