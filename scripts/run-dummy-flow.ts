import fs from 'fs';
import path from 'path';
import { simpleParser } from 'mailparser';

import { parseGlobalTixEmail } from '../src/parsers/globaltix-email.parser';
import { OrderReader } from '../src/db/order.reader';
import { ThirdPartyService } from '../src/services/third-party.service';

async function run() {
  console.log('🧪 Running dummy email → API flow');

  /* ======================================================
   * 1. LOAD EMAIL DUMMY (.eml)
   * ====================================================== */
  const rawEmail = fs.readFileSync(
    path.join(__dirname, '../test-data/emails/globaltix-1.eml'),
    'utf8'
  );

  /* ======================================================
   * 2. PARSE EMAIL
   * ====================================================== */
  const mail = await simpleParser(rawEmail);
  const order = parseGlobalTixEmail(mail);

  if (!order) {
    throw new Error('Email is not a valid GlobalTix email');
  }

  console.log('📧 Parsed order:', {
    referenceNumber: order.referenceNumber,
    customer: order.customerName,
    items: order.items.length
  });

  /* ======================================================
   * 3. INIT DUMMY THIRD-PARTY API
   * ====================================================== */
  const thirdParty = new ThirdPartyService({
    baseUrl: 'http://localhost:4000/api',
    apiKey: 'dummy-api-key',
    timeoutMs: 5_000
  });

  /* ======================================================
   * 4. PUSH EACH ITEM (IDEMPOTENT STYLE)
   * ====================================================== */
  for (const item of order.items) {
    console.log(
      `➡️ Sending confirmationCode=${item.confirmationCode}`
    );

    await thirdParty.sendOrderByConfirmationCode(
      item.confirmationCode
    );
  }

  console.log('✅ Dummy flow completed successfully');
}

run().catch(err => {
  console.error('❌ Dummy flow failed:', err);
  process.exit(1);
});