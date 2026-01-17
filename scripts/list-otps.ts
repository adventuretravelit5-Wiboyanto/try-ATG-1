#!/usr/bin/env ts-node

/**
 * ADMIN UTILITY: List Pending OTPs
 * 
 * Usage:
 *   npm run list-otps
 */

import { OTPService } from '../src/services/otp.service';
import { UploadOTPRepository } from '../src/db/upload-otp.repository';

async function main() {
    console.log('🔍 Fetching pending OTPs...\n');

    const otpService = new OTPService();
    const otpRepo = new UploadOTPRepository();

    try {
        // Expire old OTPs first
        await otpService.expireOldOTPs();

        // Get pending OTPs
        const pendingOTPs = await otpService.getPendingOTPs();

        if (pendingOTPs.length === 0) {
            console.log('✅ No pending OTPs');
            process.exit(0);
        }

        console.log(`📋 Found ${pendingOTPs.length} pending OTP(s):\n`);

        for (const otp of pendingOTPs) {
            const details = await otpRepo.getOTPWithDetails(otp.otpCode);

            if (details) {
                console.log('─'.repeat(60));
                console.log(`🔑 OTP Code: ${otp.otpCode}`);
                console.log(`📋 Confirmation: ${otp.confirmationCode}`);
                console.log(`📧 Customer: ${details.customer_name} (${details.customer_email})`);
                console.log(`📄 Product: ${details.product_name}`);
                console.log(`⏰ Expires: ${new Date(otp.otpExpiresAt).toLocaleString()}`);
                console.log(`📁 PDF: ${otp.pdfFilePath}`);
                console.log('');
            }
        }

        console.log('─'.repeat(60));
        console.log('\nTo confirm an OTP, run:');
        console.log('  npm run confirm-otp <OTP_CODE>\n');

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
