import { pool } from './pool';
import { UploadOTP, CreateOTPData, OTPStatus } from '../types/otp';

/* ======================================================
 * UPLOAD OTP REPOSITORY
 * ====================================================== */

export class UploadOTPRepository {

    /* ======================================================
     * CREATE OTP
     * ====================================================== */
    async createOTP(data: CreateOTPData): Promise<UploadOTP> {
        const query = `
            INSERT INTO upload_otps (
                order_id,
                order_item_id,
                confirmation_code,
                otp_code,
                otp_expires_at,
                pdf_file_path,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
            RETURNING *
        `;

        const values = [
            data.orderId,
            data.orderItemId,
            data.confirmationCode,
            data.otpCode,
            data.otpExpiresAt,
            data.pdfFilePath
        ];

        const result = await pool.query(query, values);
        return this.mapRowToOTP(result.rows[0]);
    }

    /* ======================================================
     * FIND OTP BY CODE
     * ====================================================== */
    async findByCode(otpCode: string): Promise<UploadOTP | null> {
        const query = `
            SELECT * FROM upload_otps
            WHERE otp_code = $1
            LIMIT 1
        `;

        const result = await pool.query(query, [otpCode]);

        if (result.rows.length === 0) {
            return null;
        }

        return this.mapRowToOTP(result.rows[0]);
    }

    /* ======================================================
     * CONFIRM OTP
     * ====================================================== */
    async confirmOTP(otpId: string, confirmedBy: string): Promise<void> {
        const query = `
            UPDATE upload_otps
            SET status = 'CONFIRMED',
                confirmed_by = $1,
                confirmed_at = NOW()
            WHERE id = $2
        `;

        await pool.query(query, [confirmedBy, otpId]);
    }

    /* ======================================================
     * UPDATE STATUS
     * ====================================================== */
    async updateStatus(otpId: string, status: OTPStatus): Promise<void> {
        const query = `
            UPDATE upload_otps
            SET status = $1
            WHERE id = $2
        `;

        await pool.query(query, [status, otpId]);
    }

    /* ======================================================
     * UPDATE GLOBALTIX RESPONSE
     * ====================================================== */
    async updateGlobalTixResponse(
        otpId: string,
        uploadUrl: string,
        response: any
    ): Promise<void> {
        const query = `
            UPDATE upload_otps
            SET globaltix_upload_url = $1,
                globaltix_response = $2
            WHERE id = $3
        `;

        await pool.query(query, [uploadUrl, JSON.stringify(response), otpId]);
    }

    /* ======================================================
     * GET PENDING OTPS
     * ====================================================== */
    async getPendingOTPs(): Promise<UploadOTP[]> {
        const query = `
            SELECT * FROM upload_otps
            WHERE status = 'PENDING'
            AND otp_expires_at > NOW()
            ORDER BY created_at DESC
        `;

        const result = await pool.query(query);
        return result.rows.map(row => this.mapRowToOTP(row));
    }

    /* ======================================================
     * EXPIRE OLD OTPS
     * ====================================================== */
    async expireOldOTPs(): Promise<number> {
        const query = `
            UPDATE upload_otps
            SET status = 'EXPIRED'
            WHERE status = 'PENDING'
            AND otp_expires_at <= NOW()
        `;

        const result = await pool.query(query);
        return result.rowCount || 0;
    }

    /* ======================================================
     * GET OTP WITH ORDER DETAILS
     * ====================================================== */
    async getOTPWithDetails(otpCode: string) {
        const query = `
            SELECT 
                uo.*,
                o.reference_number,
                o.customer_name,
                o.customer_email,
                oi.product_name,
                oi.sku
            FROM upload_otps uo
            JOIN orders o ON uo.order_id = o.id
            JOIN order_items oi ON uo.order_item_id = oi.id
            WHERE uo.otp_code = $1
        `;

        const result = await pool.query(query, [otpCode]);

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    }

    /* ======================================================
     * MAPPER
     * ====================================================== */
    private mapRowToOTP(row: any): UploadOTP {
        return {
            id: row.id,
            orderId: row.order_id,
            orderItemId: row.order_item_id,
            confirmationCode: row.confirmation_code,

            otpCode: row.otp_code,
            otpExpiresAt: row.otp_expires_at,

            pdfFilePath: row.pdf_file_path,
            globaltixUploadUrl: row.globaltix_upload_url,
            globaltixResponse: row.globaltix_response,

            status: row.status,

            confirmedBy: row.confirmed_by,
            confirmedAt: row.confirmed_at,

            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}
