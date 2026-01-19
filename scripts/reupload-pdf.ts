import 'dotenv/config';
import path from 'path';
import fs from 'fs/promises';

import { EsimRepository } from '../src/db/esim.repository';
import { logger } from '../src/utils/logger';

/* ======================================================
 * CONFIG
 * ====================================================== */

const PDF_DIR = path.resolve(process.cwd(), 'data/pdf');
const LIMIT = Number(process.env.REUPLOAD_LIMIT ?? 20);

/* ======================================================
 * MAIN
 * ====================================================== */

async function reuploadPdf(): Promise<void> {
    logger.info('📤 Starting reupload-pdf script');

    const esimRepo = new EsimRepository();

    /* ======================================================
     * FETCH ESIMs NEEDING PDF REPAIR
     * ====================================================== */

    const esims = await esimRepo.findCompletedButNotDone();

    if (esims.length === 0) {
        logger.info('✅ No PDFs pending reupload');
        return;
    }

    logger.info(`📦 Found ${esims.length} PDF(s) to re-check`);

    /* ======================================================
     * LOOP
     * ====================================================== */

    for (const esim of esims.slice(0, LIMIT)) {
        const fileName = `${esim.reference_number}_${esim.iccid}.pdf`;
        const pdfPath = path.join(PDF_DIR, fileName);

        logger.info('➡️ Checking PDF file', {
            esimId: esim.id,
            orderItemId: esim.order_item_id,
            iccid: esim.iccid,
            fileName
        });

        try {
            /* ==========================================
             * VERIFY FILE EXISTS
             * ========================================== */

            await fs.access(pdfPath);

            /* ==========================================
             * FILE EXISTS → MARK DONE
             * ========================================== */

            await esimRepo.markAsDone(esim.id);

            logger.info('✅ PDF exists & marked as DONE', {
                fileName,
                esimId: esim.id
            });

        } catch {
            logger.warn('⚠️ PDF missing, mark as FAILED', {
                fileName,
                pdfPath
            });

            await esimRepo.markFailed(esim.id);
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
