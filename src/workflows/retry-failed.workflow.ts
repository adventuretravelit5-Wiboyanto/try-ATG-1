import { OrderRepository } from '../db/order.repository';
import { finalizeOrderWorkflow } from './finalize-order.workflow';
import { logger } from '../utils/logger';
import { ORDER_STATUS } from '../constants/order-status';

const MAX_RETRY = 3;

/**
 * Retry failed orders
 *
 * - Fetch FAILED orders
 * - Retry up to MAX_RETRY
 */
export async function retryFailedWorkflow(): Promise<void> {
  const orderRepo = new OrderRepository();

  logger.info('🔁 Retry failed orders started');

  const failedOrders = await orderRepo.findFailedOrders();

  if (failedOrders.length === 0) {
    logger.info('✅ No failed orders to retry');
    return;
  }

  for (const order of failedOrders) {
    if (order.retryCount >= MAX_RETRY) {
      logger.warn('⛔ Retry limit reached', {
        orderId: order.id,
        retryCount: order.retryCount
      });
      continue;
    }

    try {
      logger.info('🔄 Retrying order', {
        orderId: order.id,
        attempt: order.retryCount + 1
      });

      /* ==============================
       * 1. MARK AS RETRYING
       * ============================== */
      await orderRepo.updateRetrying(
        order.id,
        order.retryCount + 1
      );

      /* ==============================
       * 2. RUN FINALIZE WORKFLOW
       * ============================== */
      await finalizeOrderWorkflow(order.id);
    } catch (error) {
      logger.error('❌ Retry failed', {
        orderId: order.id,
        error
      });

      /* ==============================
       * 3. MARK FAILED AGAIN
       * ============================== */
      await orderRepo.markFailed(order.id);
    }
  }

  logger.info('🏁 Retry workflow finished');
}
