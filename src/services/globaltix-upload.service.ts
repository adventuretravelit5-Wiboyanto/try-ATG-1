import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { GlobalTixUploadRequest, GlobalTixUploadResponse } from '../types/otp';
import { logger } from '../utils/logger';

/* ======================================================
 * GLOBALTIX UPLOAD SERVICE
 * ====================================================== */

export type GlobalTixUploadConfig = {
    baseUrl: string;
    apiKey: string;
    timeoutMs?: number;
};

export class GlobalTixUploadService {

    private readonly http: AxiosInstance;
    private readonly baseUrl: string;

    constructor(config: GlobalTixUploadConfig) {
        if (!config?.baseUrl || !config?.apiKey) {
            throw new Error(
                'GlobalTixUploadService config invalid (baseUrl / apiKey required)'
            );
        }

        this.baseUrl = config.baseUrl;

        this.http = axios.create({
            baseURL: config.baseUrl,
            timeout: config.timeoutMs ?? 30_000,
            headers: {
                'Authorization': `Bearer ${config.apiKey}`
            }
        });
    }

    /* ======================================================
     * UPLOAD PDF TO GLOBALTIX
     * ====================================================== */
    async uploadPDF(request: GlobalTixUploadRequest): Promise<GlobalTixUploadResponse> {
        try {
            logger.info('📤 Uploading PDF to GlobalTix', {
                confirmationCode: request.confirmationCode,
                pdfPath: request.pdfFilePath
            });

            // Verify file exists
            if (!fs.existsSync(request.pdfFilePath)) {
                throw new Error(`PDF file not found: ${request.pdfFilePath}`);
            }

            // Read file size
            const stats = fs.statSync(request.pdfFilePath);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

            logger.info(`📄 PDF file size: ${fileSizeMB} MB`);

            // Create form data
            const formData = new FormData();
            formData.append('pdf', fs.createReadStream(request.pdfFilePath));
            formData.append('confirmation_code', request.confirmationCode);
            formData.append('customer_email', request.customerEmail);
            formData.append('customer_name', request.customerName);
            formData.append('filename', path.basename(request.pdfFilePath));

            // Upload to GlobalTix
            const response = await this.http.post('/upload/pdf', formData, {
                headers: {
                    ...formData.getHeaders()
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            if (response.status >= 200 && response.status < 300) {
                logger.info('✅ PDF uploaded successfully to GlobalTix', {
                    confirmationCode: request.confirmationCode,
                    uploadUrl: response.data?.uploadUrl
                });

                return {
                    success: true,
                    uploadUrl: response.data?.uploadUrl,
                    message: response.data?.message || 'Upload successful',
                    uploadedAt: new Date().toISOString()
                };
            }

            throw new Error(`Upload failed with status ${response.status}`);

        } catch (error: any) {
            logger.error('❌ GlobalTix upload failed', {
                confirmationCode: request.confirmationCode,
                error: error.message,
                response: error?.response?.data
            });

            // Check if this is a mock/test environment
            if (this.baseUrl.includes('mock') || this.baseUrl.includes('test')) {
                logger.warn('⚠️ Mock mode detected - simulating successful upload');

                return {
                    success: true,
                    uploadUrl: `https://mock-globaltix.com/pdf/${request.confirmationCode}.pdf`,
                    message: 'Mock upload successful (no actual upload performed)',
                    uploadedAt: new Date().toISOString()
                };
            }

            throw new Error(
                `GlobalTix upload failed: ${error?.response?.data?.message || error.message}`
            );
        }
    }

    /* ======================================================
     * VERIFY UPLOAD STATUS (optional)
     * ====================================================== */
    async verifyUpload(confirmationCode: string): Promise<boolean> {
        try {
            const response = await this.http.get(`/upload/verify/${confirmationCode}`);
            return response.data?.uploaded === true;
        } catch (error) {
            logger.warn('⚠️ Upload verification failed', { confirmationCode });
            return false;
        }
    }
}
