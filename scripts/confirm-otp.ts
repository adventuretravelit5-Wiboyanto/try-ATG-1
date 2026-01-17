#!/usr/bin/env ts-node

/**
 * ADMIN SCRIPT: Confirm Upload OTP
 * 
 * Usage:
 *   npm run confirm-otp <OTP_CODE> [ADMIN_NAME]
 *   
 * Example:
 *   npm run confirm-otp 123456 "Admin John"
 */

import { OTPService } from '../src/services/otp.service';
import { UploadOTPRepository } from '../src/db/upload-otp.repository';
import { EsimRepository } from '../src/db/esim.repository';
import { OrderRepository } from '../src/db/order.repository';
import { logger } from '../src/utils/logger';

/* ======================================================
 * MAIN
 * ====================================================== */

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('❌ Error: OTP code is required');
        console.log('\nUsage:');
        console.log('  npm run confirm-otp <OTP_CODE> [ADMIN_NAME]');
        console.log('\nExample:');
        console.log('  npm run confirm-otp 123456 "Admin John"');
        process.exit(1);
    }

    const otpCode = args[0];
    const adminName = args[1] || 'System Admin';

    console.log('🔐 Confirming OTP...\n');

    const otpService = new OTPService();
    const otpRepo = new UploadOTPRepository();
    const esimRepo = new EsimRepository();
    const orderRepo = new OrderRepository();

    try {
        /* ======================================================
         * 1. VALIDATE
OTP
         * ====================================================== */
        const validation = await otpService.validateOTP(otpCode);

        if (!validation.valid) {
            console.error(`❌ ${validation.reason}`);
            process.exit(1);
        }

        /* ======================================================
         * 2. GET OTP DETAILS
         * ====================================================== */
        const otpDetails = await otpRepo.getOTPWithDetails(otpCode);

        if (!otpDetails) {
            console.error('❌ OTP not found');
            process.exit(1);
        }

        console.log('📋 OTP Details:');
        console.log(`   Reference: ${otpDetails.reference_number}`);
        console.log(`   Confirmation Code: ${otpDetails.confirmation_code}`);
        console.log(`   Customer: ${otpDetails.customer_name} (${otpDetails.customer_email})`);
        console.log(`   Product: ${otpDetails.product_name}`);
        console.log(`   PDF: ${otpDetails.pdf_file_path}`);
        console.log('');

        /* ======================================================
         * 3. CONFIRM OTP
         * ====================================================== */
        const result = await otpService.confirmOTP({
            otpCode,
            confirmedBy: adminName
        });

        if (!result.success) {
            console.error(`❌ ${result.message}`);
            process.exit(1);
        }

        /* ======================================================
         * 4. UPDATE ESIM STATUS TO DONE
         * ====================================================== */
        const esim = await esimRepo.findByOrderItemId(otpDetails.order_item_id);

        if (esim) {
            await esimRepo.confirmPdfUpload(esim.id);
            logger.info('✅ eSIM status updated to DONE', {
                esimId: esim.id
            });
        }

        /* ======================================================
         * 5. MARK ORDER ITEM AS COMPLETED
         * ====================================================== */
        await orderRepo.markItemCompleted(otpDetails.order_item_id);

        /* ======================================================
         * 6. SUCCESS
         * ====================================================== */
        console.log('✅ OTP Confirmed Successfully!\n');
        console.log(`   Confirmed by: ${adminName}`);
        console.log(`   Status: PDF upload confirmed`);
        console.log(`   Order completed: ${otpDetails.confirmation_code}`);
        console.log('');

        process.exit(0);

    } catch (error: any) {
        console.error('❌ Error confirming OTP:');
        console.error(error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

/* ======================================================
 * RUN
 * ====================================================== */

if (require.main === module) {
    main();
}
