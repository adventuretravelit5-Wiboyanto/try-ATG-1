#!/usr/bin/env ts-node

import { EsimRepository } from '../src/db/esim.repository';
import { OrderRepository } from '../src/db/order.repository';
import { PdfService } from '../src/services/pdf-service';

import { logger } from '../src/utils/logger';

/* ======================================================
 * CLI ARGUMENT
 * ====================================================== */
/**
 * Usage:
 *   ts-node scripts/regenerate-pdf.ts CONFIRMATION_CODE
 *   ts-node scripts/regenerate-pdf.ts --all
 */

const args = process.argv.slice(2);
const targetCode = args[0];

/* ======================================================
 * MAIN
 * ====================================================== */
async function main() {
    logger.info('[REGENERATE PDF] Started');

    const esimRepo = new EsimRepository();
    const orderRepo = new OrderRepository();
    const pdfService = new PdfService();

    let esims: any[] = [];

    /* --------------------------------------------------
     * MODE SELECTION
     * -------------------------------------------------- */
    if (targetCode === '--all') {
        logger.info('[REGENERATE PDF] Mode: ALL DONE ESIM');
        esims = await esimRepo.findDoneEsims();
    } else if (targetCode) {
        logger.info('[REGENERATE PDF] Mode: SINGLE', {
            confirmationCode: targetCode
        });

        const orderItem = await orderRepo.findItemByConfirmationCode(
            targetCode
        );

        if (!orderItem) {
            throw new Error(`Order item not found: ${targetCode}`);
        }

        const esim = await esimRepo.findByOrderItemId(orderItem.id);

        if (!esim) {
            throw new Error(`eSIM not found for: ${targetCode}`);
        }

        esims = [esim];
    } else {
        throw new Error(
            'Missing argument. Use CONFIRMATION_CODE or --all'
        );
    }

    /* --------------------------------------------------
     * PROCESS
     * -------------------------------------------------- */
    for (const esim of esims) {

        const orderItem = await orderRepo.findItemById(
            esim.order_item_id
        );

        if (!orderItem) {
            logger.warn('[REGENERATE PDF] Order item missing', {
                orderItemId: esim.order_item_id
            });
            continue;
        }

        const confirmationCode = orderItem.confirmation_code;
        const referenceNumber  = orderItem.reference_number;

        logger.info('[REGENERATE PDF] Generating', {
            confirmationCode
        });

        await pdfService.generateEsimPdf({
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
            validUntil: esim.valid_until,
            force: true
        });

        logger.info('[REGENERATE PDF] Done', {
            confirmationCode
        });
    }

    logger.info('[REGENERATE PDF] Finished');
    process.exit(0);
}

/* ======================================================
 * RUN
 * ====================================================== */
main().catch(err => {
    logger.error('[REGENERATE PDF] Fatal error', err);
    process.exit(1);
});
