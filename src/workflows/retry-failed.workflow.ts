// src/workflows/retry-failed.workflow.ts

import { FinalizeOrderWorkflow } from './finalize-order.workflow';
import { logger } from '../utils/logger';

/* ======================================================
 * RETRY FAILED WORKFLOW
 * ====================================================== */

/**
 * Retry failed FINALIZATION (PDF + Email)
 *
 * - Relies on sync_logs for idempotency
 * - FinalizeOrderWorkflow will:
 *   - Skip SUCCESS
 *   - Retry FAILED
 */
export async function retryFailedWorkflow(): Promise<void> {

    logger.info('[RETRY] Retry failed finalization started');

    const finalizeWorkflow =
        new FinalizeOrderWorkflow();

    try {
        await finalizeWorkflow.run();

        logger.info('[RETRY] Retry workflow finished');

    } catch (err) {
        logger.error('[RETRY] Fatal retry error', err);
        throw err;
    }
    
}
