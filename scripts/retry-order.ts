import 'dotenv/config';
import { SyncLogRepository } from '../src/db/sync-log.repository';
import { ThirdPartyService } from '../src/services/third-party.service';
import { logger } from '../src/utils/logger';

/* ======================================================
 * CONFIG
 * ====================================================== */

const TARGET_SERVICE = 'third-party-service';
const RETRY_LIMIT = Number(process.env.RETRY_LIMIT ?? 20);

/* ======================================================
 * MAIN
 * ====================================================== */

async function retryFailedOrders() {
    logger.info('🔁 Starting retry-order script');

    const syncLogRepo = new SyncLogRepository();

    const thirdPartyService = new ThirdPartyService({
        baseUrl: process.env.THIRD_PARTY_API_BASE_URL!,
        apiKey: process.env.THIRD_PARTY_API_KEY!,
        timeoutMs: Number(process.env.THIRD_PARTY_API_TIMEOUT_MS ?? 15000)
    });

    /* ======================================================
     * FETCH FAILED LOGS
     * ====================================================== */

    const failedLogs = await syncLogRepo.getFailedLogs(RETRY_LIMIT);

    if (failedLogs.length === 0) {
        logger.info('✅ No failed orders to retry');
        return;
    }

    logger.info(
        `📦 Found ${failedLogs.length} failed order(s) to retry`
    );

    /* ======================================================
     * RETRY LOOP
     * ====================================================== */

    for (const log of failedLogs) {
        const confirmationCode = log.confirmation_code;

        logger.info(
            `➡️ Retrying confirmationCode=${confirmationCode}`
        );

        try {
            await thirdPartyService.sendOrderByConfirmationCode(
                confirmationCode
            );

            logger.info(
                `✅ Retry success for ${confirmationCode}`
            );

        } catch (error: any) {

            logger.error(
                `❌ Retry failed for ${confirmationCode}`,
                {
                    error: error?.message
                }
            );

            // ❗ Do NOT throw → continue next retry
        }
    }

    logger.info('🏁 Retry-order script finished');
}

/* ======================================================
 * EXECUTE
 * ====================================================== */

retryFailedOrders()
    .then(() => process.exit(0))
    .catch((err) => {
        logger.error('💥 Retry-order script crashed', err);
        process.exit(1);
    });
