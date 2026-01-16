import 'dotenv/config';

import { GmailWorker } from '../src/index';
import { verifyEnv } from '../src/config/env';
import { verifyDbConnection } from '../src/db/pool';
import { logger } from '../src/utils/logger';

/* ======================================================
 * BOOTSTRAP
 * ====================================================== */

async function bootstrap() {
    try {
        logger.info('🚀 Starting Gmail Worker');

        /* ==========================================
         * ENV VALIDATION
         * ========================================== */
        verifyEnv();
        logger.info('✓ Configuration valid');

        /* ==========================================
         * DATABASE CHECK
         * ========================================== */
        await verifyDbConnection();

        /* ==========================================
         * START WORKER
         * ========================================== */
        const worker = new GmailWorker();

        await worker.start();

        logger.info('📬 Gmail Worker is running');

        /* ==========================================
         * GRACEFUL SHUTDOWN
         * ========================================== */
        const shutdown = async (signal: string) => {
            logger.warn(`🛑 Received ${signal}, shutting down...`);

            try {
                await worker.stop();
                logger.info('✅ Worker stopped gracefully');
                process.exit(0);
            } catch (err) {
                logger.error('❌ Error during shutdown', err);
                process.exit(1);
            }
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (error) {
        logger.error('💥 Failed to start Gmail Worker', error);
        process.exit(1);
    }
}

/* ======================================================
 * EXECUTE
 * ====================================================== */

bootstrap();
