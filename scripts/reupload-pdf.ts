import 'dotenv/config';
import path from 'path';
import fs from 'fs/promises';

import { EsimRepository } from '../src/db/esim.repository';
import { PdfService } from '../src/services/pdf-service';
import { SmtpService } from '../src/services/smtp-service';
import { logger } from '../src/utils/logger';

/* ======================================================
 * CONFIG
 * ====================================================== */

const PDF_DIR = path.resolve(process.cwd(), 'data/pdf');
const LIMIT = Number(process.env.REUPLOAD_LIMIT ?? 20);

/* ======================================================
 * MAIN
 * ====================================================== */

async function reuploadPdf() {
    logger.info('📤 Starting reupload-pdf script');

    const esimRepo = new EsimRepository();
    const smtpService = new SmtpService();
    const pdfService = new PdfService();

    /* ======================================================
     * FETCH ESIM READY BUT NOT DONE
     * ====================================================== */

    const esims = await esimRepo.findPendingUpload(LIMIT);

    if (esims.length === 0) {
        logger.info('✅ No PDFs pending upload');
        return;
    }

    logger.info(`📦 Found ${esims.length} PDF(s) to reupload`);

    /* ======================================================
     * LOOP
     * ====================================================== */

    for (const esim of esims) {
        const fileName = `${esim.reference_number}_${esim.iccid}.pdf`;
        const pdfPath = path.join(PDF_DIR, fileName);

        logger.info(`➡️ Reuploading PDF: ${fileName}`);

        try {
            /* ==========================================
             * VERIFY FILE EXISTS
             * ========================================== */

            await fs.access(pdfPath);

            /* ==========================================
             * SEND TO GLOBALTIX
             * ========================================== */

            await smtpService.sendPdf({
                to: esim.customer_email,
                subject: `Your eSIM - ${esim.product_name}`,
                pdfPath
            });

            /* ==========================================
             * UPDATE STATUS → DONE
             * ========================================== */

            await esimRepo.updateStatus(
                esim.order_item_id,
                'DONE'
            );

            logger.info(`✅ PDF uploaded: ${fileName}`);

        } catch (error: any) {

            logger.error(
                `❌ Failed reupload PDF: ${fileName}`,
                { error: error?.message }
            );

            // ❗ Continue next PDF
        }
    }

    logger.info('🏁 reupload-pdf script finished');
}

/* ======================================================
 * EXECUTE
 * ====================================================== */

reuploadPdf()
    .then(() => process.exit(0))
    .catch((err) => {
        logger.error('💥 reupload-pdf script crashed', err);
        process.exit(1);
    });
