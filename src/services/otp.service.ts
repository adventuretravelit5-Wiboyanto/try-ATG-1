import crypto from 'crypto';
import { UploadOTPRepository } from '../db/upload-otp.repository';
import { CreateOTPData, ConfirmOTPData } from '../types/otp';
import { logger } from '../utils/logger';

/* ======================================================
 * OTP SERVICE
 * ====================================================== */

export class OTPService {

    private readonly otpRepo: UploadOTPRepository;
    private readonly otpLength: number;
    private readonly expiryHours: number;

    constructor(
        otpRepo = new UploadOTPRepository(),
        otpLength = 6,
        expiryHours = 24
    ) {
        this.otpRepo = otpRepo;
        this.otpLength = otpLength;
        this.expiryHours = expiryHours;
    }

    /* ======================================================
     * GENERATE OTP CODE
     * ====================================================== */
    generateOTPCode(): string {
        const digits = '0123456789';
        let otp = '';

        for (let i = 0; i < this.otpLength; i++) {
            const randomIndex = crypto.randomInt(0, digits.length);
            otp += digits[randomIndex];
        }

        return otp;
    }

    /* ======================================================
     * CREATE UPLOAD OTP
     * ====================================================== */
    async createUploadOTP(data: {
        orderId: string;
        orderItemId: string;
        confirmationCode: string;
        pdfFilePath: string;
    }) {
        const otpCode = this.generateOTPCode();
        const otpExpiresAt = new Date();
        otpExpiresAt.setHours(otpExpiresAt.getHours() + this.expiryHours);

        const otpData: CreateOTPData = {
            orderId: data.orderId,
            orderItemId: data.orderItemId,
            confirmationCode: data.confirmationCode,
            otpCode,
            otpExpiresAt,
            pdfFilePath: data.pdfFilePath
        };

        const uploadOTP = await this.otpRepo.createOTP(otpData);

        logger.info('🔐 OTP Created', {
            otpCode: uploadOTP.otpCode,
            confirmationCode: data.confirmationCode,
            expiresAt: otpExpiresAt.toISOString()
        });

        // Print to console for admin
        this.printOTPToConsole(uploadOTP.otpCode, data.confirmationCode);

        return uploadOTP;
    }

    /* ======================================================
     * VALIDATE OTP
     * ====================================================== */
    async validateOTP(otpCode: string): Promise<{
        valid: boolean;
        reason?: string;
        otp?: any;
    }> {
        const otp = await this.otpRepo.findByCode(otpCode);

        if (!otp) {
            return {
                valid: false,
                reason: 'OTP not found'
            };
        }

        if (otp.status === 'CONFIRMED') {
            return {
                valid: false,
                reason: 'OTP already used',
                otp
            };
        }

        if (otp.status === 'EXPIRED') {
            return {
                valid: false,
                reason: 'OTP expired',
                otp
            };
        }

        if (new Date() > otp.otpExpiresAt) {
            await this.otpRepo.updateStatus(otp.id, 'EXPIRED');
            return {
                valid: false,
                reason: 'OTP expired',
                otp
            };
        }

        return {
            valid: true,
            otp
        };
    }

    /* ======================================================
     * CONFIRM OTP
     * ====================================================== */
    async confirmOTP(data: ConfirmOTPData): Promise<{
        success: boolean;
        message: string;
        otp?: any;
    }> {
        const validation = await this.validateOTP(data.otpCode);

        if (!validation.valid) {
            return {
                success: false,
                message: validation.reason || 'Invalid OTP'
            };
        }

        await this.otpRepo.confirmOTP(validation.otp.id, data.confirmedBy);

        logger.info('✅ OTP Confirmed', {
            otpCode: data.otpCode,
            confirmedBy: data.confirmedBy,
            confirmationCode: validation.otp.confirmationCode
        });

        return {
            success: true,
            message: 'OTP confirmed successfully',
            otp: validation.otp
        };
    }

    /* ======================================================
     * GET PENDING OTPS
     * ====================================================== */
    async getPendingOTPs() {
        return await this.otpRepo.getPendingOTPs();
    }

    /* ======================================================
     * EXPIRE OLD OTPS (CLEANUP)
     * ====================================================== */
    async expireOldOTPs() {
        const expired = await this.otpRepo.expireOldOTPs();

        if (expired > 0) {
            logger.info(`⏰ Expired ${expired} old OTPs`);
        }

        return expired;
    }

    /* ======================================================
     * PRINT OTP TO CONSOLE (for admin)
     * ====================================================== */
    private printOTPToConsole(otpCode: string, confirmationCode: string): void {
        console.log('\n' + '='.repeat(60));
        console.log('🔐 NEW OTP GENERATED FOR PDF UPLOAD');
        console.log('='.repeat(60));
        console.log(`📋 Confirmation Code: ${confirmationCode}`);
        console.log(`🔑 OTP Code:          ${otpCode}`);
        console.log(`⏰ Expires in:        ${this.expiryHours} hours`);
        console.log('='.repeat(60));
        console.log(`To confirm: npm run confirm-otp ${otpCode}`);
        console.log('='.repeat(60) + '\n');
    }
}
