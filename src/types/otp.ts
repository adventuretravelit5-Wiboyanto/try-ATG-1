/* ======================================================
 * UPLOAD OTP TYPES
 * ====================================================== */

export type OTPStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'FAILED';

export interface UploadOTP {
    id: string;
    orderId: string;
    orderItemId: string;
    confirmationCode: string;

    otpCode: string;
    otpExpiresAt: Date;

    pdfFilePath: string;
    globaltixUploadUrl?: string;
    globaltixResponse?: any;

    status: OTPStatus;

    confirmedBy?: string;
    confirmedAt?: Date;

    createdAt: Date;
    updatedAt: Date;
}

export interface CreateOTPData {
    orderId: string;
    orderItemId: string;
    confirmationCode: string;
    otpCode: string;
    otpExpiresAt: Date;
    pdfFilePath: string;
}

export interface ConfirmOTPData {
    otpCode: string;
    confirmedBy: string;
}

/* ======================================================
 * GLOBALTIX UPLOAD TYPES
 * ====================================================== */

export interface GlobalTixUploadRequest {
    confirmationCode: string;
    pdfFilePath: string;
    customerEmail: string;
    customerName: string;
}

export interface GlobalTixUploadResponse {
    success: boolean;
    uploadUrl?: string;
    message?: string;
    uploadedAt?: string;
}
