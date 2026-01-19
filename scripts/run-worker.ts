import 'dotenv/config';

import { GmailWorker } from '../src';
// import { validateEnv } from '../src/config/env';
import { verifyDbConnection } from '../src/db/pool';
import { logger } from '../src/utils/logger';

/* ======================================================
 * BOOTSTRAP
 * ====================================================== */

async function bootstrap() {
    let isShuttingDown = false;
    let worker: GmailWorker | null = null;

    try {
        logger.info('🚀 Starting Gmail Worker');

        /* ==========================================
         * ENV VALIDATION
         * ========================================== */
        // validateEnv();
        // logger.info('✓ Environment configuration valid');

        /* ==========================================
         * DATABASE CHECK
         * ========================================== */
        await verifyDbConnection();
        logger.info('✓ Database connection OK');

        /* ==========================================
         * START WORKER
         * ========================================== */
        worker = new GmailWorker();

        await worker.start();
        logger.info('📬 Gmail Worker is running');

    } catch (error) {
        logger.error('💥 Failed to start Gmail Worker', error);
        process.exit(1);
    }

    /* ==========================================
     * GRACEFUL SHUTDOWN
     * ========================================== */
    const shutdown = async (signal: string) => {
        if (isShuttingDown) return;
        isShuttingDown = true;

        logger.warn(`🛑 Received ${signal}, shutting down...`);

        try {
            if (worker) {
                await worker.stop();
                logger.info('✅ Worker stopped gracefully');
            }
            process.exit(0);
        } catch (err) {
            logger.error('❌ Error during shutdown', err);
            process.exit(1);
        }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    /* ==========================================
     * GLOBAL ERROR HANDLERS
     * ========================================== */
    process.on('unhandledRejection', (reason) => {
        logger.error('💥 Unhandled Promise Rejection', reason);
    });

    process.on('uncaughtException', (error) => {
        logger.error('💥 Uncaught Exception', error);
        shutdown('uncaughtException');
    });
}

/* ======================================================
 * EXECUTE
 * ====================================================== */

bootstrap();
