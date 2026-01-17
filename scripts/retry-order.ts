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
    logger.info('🔁 [RETRY ORDER] Script started');

    const syncLogRepo = new SyncLogRepository();

    const thirdPartyService = new ThirdPartyService({
        baseUrl: process.env.THIRD_PARTY_API_BASE_URL!,
        apiKey: process.env.THIRD_PARTY_API_KEY!,
        timeoutMs: Number(
            process.env.THIRD_PARTY_API_TIMEOUT_MS ?? 15000
        )
    });

    /* ======================================================
     * FETCH FAILED LOGS
     * ====================================================== */

    const failedLogs =
        await syncLogRepo.getFailedLogs(
            TARGET_SERVICE,
            RETRY_LIMIT
        );

    if (failedLogs.length === 0) {
        logger.info('✅ No failed orders to retry');
        return;
    }

    logger.info(
        `📦 Found ${failedLogs.length} failed order(s)`
    );

    /* ======================================================
     * RETRY LOOP
     * ====================================================== */

    for (const log of failedLogs) {
        const confirmationCode = log.confirmation_code;

        logger.info('➡️ Retrying order', {
            confirmationCode,
            attempt: log.attempt_count + 1
        });

        try {
            /* ----------------------------------------------
             * SEND TO THIRD PARTY
             * ---------------------------------------------- */
            const response =
                await thirdPartyService
                    .sendOrderByConfirmationCode(
                        confirmationCode
                    );

            /* ----------------------------------------------
             * MARK SUCCESS
             * ---------------------------------------------- */
            await syncLogRepo.upsertLog({
                confirmationCode,
                referenceNumber: log.reference_number,
                targetService: TARGET_SERVICE,
                requestPayload: {
                    confirmationCode
                },
                responsePayload: response,
                status: 'SUCCESS'
            });

            logger.info('✅ Retry success', {
                confirmationCode
            });

        } catch (error: any) {

            /* ----------------------------------------------
             * MARK FAILED AGAIN
             * ---------------------------------------------- */
            await syncLogRepo.upsertLog({
                confirmationCode,
                referenceNumber: log.reference_number,
                targetService: TARGET_SERVICE,
                requestPayload: {
                    confirmationCode
                },
                responsePayload: null,
                status: 'FAILED',
                errorMessage: error?.message
            });

            logger.error('❌ Retry failed', {
                confirmationCode,
                error: error?.message
            });

            // ❗ do NOT throw → continue next
        }
    }

    logger.info('🏁 [RETRY ORDER] Script finished');
}

/* ======================================================
 * EXECUTE
 * ====================================================== */

retryFailedOrders()
    .then(() => process.exit(0))
    .catch((err) => {
        logger.error(
            '💥 [RETRY ORDER] Script crashed',
            err
        );
        process.exit(1);
    });
