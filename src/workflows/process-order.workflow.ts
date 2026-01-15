// src/workflows/process-order.workflow.ts

import { ParsedMail } from 'mailparser';

import { parseGlobalTixEmail } from '../parsers/globaltix-email.parser';
import { OrderRepository } from '../db/order.repository';
import { logger } from '../utils/logger';

/**
 * Process incoming GlobalTix email:
 * 1. Parse email (text + html)
 * 2. Upsert order
 * 3. Upsert order items
 * 4. Mark order as RECEIVED
 *
 * ❗ No third-party call
 * ❗ No eSIM provisioning
 * ❗ No PDF generation
 */
export async function processIncomingEmail(
  mail: ParsedMail
): Promise<void> {
  logger.info('📩 Processing incoming email');

  /* ======================================================
   * 1. PARSE EMAIL
   * ====================================================== */
  const parsedOrder = parseGlobalTixEmail(mail);

  if (!parsedOrder) {
    logger.warn('⚠️ Email ignored (not GlobalTix)');
    return;
  }

  logger.info('📦 Parsed GlobalTix order', {
    referenceNumber: parsedOrder.referenceNumber,
    items: parsedOrder.items.length
  });

  const orderRepo = new OrderRepository();

  /* ======================================================
   * 2. UPSERT ORDER (IDEMPOTENT)
   * ====================================================== */
  const order = await orderRepo.upsertOrder({
    referenceNumber: parsedOrder.referenceNumber,
    purchaseDate: parsedOrder.purchaseDate,
    resellerName: parsedOrder.resellerName,

    customerName: parsedOrder.customerName,
    customerEmail: parsedOrder.customerEmail,
    alternativeEmail: parsedOrder.alternativeEmail,
    mobileNumber: parsedOrder.mobileNumber,

    paymentStatus: parsedOrder.paymentStatus,
    remarks: parsedOrder.remarks
  });

  logger.info('✅ Order upserted', {
    orderId: order.id,
    referenceNumber: order.referenceNumber
  });

  /* ======================================================
   * 3. UPSERT ORDER ITEMS
   * ====================================================== */
  for (const item of parsedOrder.items) {
    await orderRepo.upsertOrderItem({
      orderId: order.id,

      confirmationCode: item.confirmationCode,
      productName: item.productName,
      productVariant: item.productVariant,
      sku: item.sku,

      visitDate: item.visitDate,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    });

    logger.info('🧾 Order item upserted', {
      confirmationCode: item.confirmationCode
    });
  }

  /* ======================================================
   * 4. UPDATE ORDER STATUS → RECEIVED
   * ====================================================== */
  await orderRepo.updateStatus(
    order.id,
    'RECEIVED'
  );

  logger.info('🎯 Order marked as RECEIVED', {
    referenceNumber: order.referenceNumber
  });
}
