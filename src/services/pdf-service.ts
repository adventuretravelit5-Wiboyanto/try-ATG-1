import { chromium, Browser } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

import { EsimRepository } from '../db/esim.repository';
import { ensureDirExists } from '../utils/file';

/* ======================================================
 * TYPES
 * ====================================================== */

export type GeneratePdfResult = {
    pdfPath: string;
    fileName: string;
};

/* ======================================================
 * SERVICE
 * ====================================================== */

export class PdfService {

    private readonly esimRepo: EsimRepository;
    private readonly templatePath: string;
    private readonly outputDir: string;

    constructor(
        esimRepo = new EsimRepository()
    ) {
        this.esimRepo = esimRepo;

        this.templatePath = path.resolve(
            process.cwd(),
            'src/pdf/templates/esim-pdf.html'
        );

        this.outputDir = path.resolve(
            process.cwd(),
            'data/pdf'
        );
    }

    /* ======================================================
     * PUBLIC API
     * ====================================================== */

    /**
     * Generate PDF for ONE eSIM detail
     */
    async generatePdfByEsimId(
        esimId: string
    ): Promise<GeneratePdfResult> {

        const esim =
            await this.esimRepo.findById(esimId);

        if (!esim) {
            throw new Error(
                `eSIM not found: ${esimId}`
            );
        }

        await ensureDirExists(this.outputDir);

        const html =
            await this.renderTemplate(esim);

        const fileName =
            `${esim.reference_number}_${esim.iccid}.pdf`;

        const pdfPath =
            path.join(this.outputDir, fileName);

        await this.generatePdf(html, pdfPath);

        return {
            pdfPath,
            fileName
        };
    }

    /* ======================================================
     * INTERNALS
     * ====================================================== */

    private async renderTemplate(
        esim: any
    ): Promise<string> {

        const template =
            await fs.readFile(this.templatePath, 'utf-8');

        /**
         * ⚠️ Simple template replace
         * (safe, deterministic, no JS execution)
         */
        return template
            .replace('{{PRODUCT_NAME}}', esim.product_name ?? '-')
            .replace('{{VALID_FROM}}', esim.valid_from ?? '-')
            .replace('{{VALID_UNTIL}}', esim.valid_until ?? '-')
            .replace('{{ICCID}}', esim.iccid ?? '-')
            .replace('{{QR_CODE}}', esim.qr_code ?? '-')
            .replace('{{SMDP_ADDRESS}}', esim.smdp_address ?? '-')
            .replace('{{ACTIVATION_CODE}}', esim.activation_code ?? '-')
            .replace('{{COMBINED_ACTIVATION}}', esim.combined_activation ?? '-')
            .replace('{{APN_NAME}}', esim.apn_name ?? '-')
            .replace('{{APN_USERNAME}}', esim.apn_username ?? '-')
            .replace('{{APN_PASSWORD}}', esim.apn_password ?? '-');
    }

    private async generatePdf(
        html: string,
        outputPath: string
    ): Promise<void> {

        let browser: Browser | null = null;

        try {
            browser = await chromium.launch({
                headless: true
            });

            const page =
                await browser.newPage();

            await page.setContent(html, {
                waitUntil: 'networkidle'
            });

            await page.pdf({
                path: outputPath,
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20mm',
                    bottom: '20mm',
                    left: '15mm',
                    right: '15mm'
                }
            });

        } catch (error: any) {
            throw new Error(
                `PDF generation failed: ${error?.message}`
            );
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}
