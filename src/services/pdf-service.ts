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
     * Generate PDF for ONE eSIM
     * Only allowed when status = READY
     */
    async generatePdfByEsimId(
        esimId: string
    ): Promise<GeneratePdfResult> {

        const esim =
            await this.esimRepo.findById(esimId);

        if (!esim) {
            throw new Error(`eSIM not found: ${esimId}`);
        }

        if (esim.status !== 'READY') {
            throw new Error(
                `PDF generation blocked. Status=${esim.status}`
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

        let template =
            await fs.readFile(this.templatePath, 'utf-8');

        return template
            .replace(/{{PRODUCT_NAME}}/g, esim.product_name ?? '-')
            .replace(/{{VALID_FROM}}/g, esim.valid_from ?? '-')
            .replace(/{{VALID_UNTIL}}/g, esim.valid_until ?? '-')
            .replace(/{{ICCID}}/g, esim.iccid ?? '-')
            .replace(/{{QR_CODE}}/g, esim.qr_code ?? '-')
            .replace(/{{SMDP_ADDRESS}}/g, esim.smdp_address ?? '-')
            .replace(/{{ACTIVATION_CODE}}/g, esim.activation_code ?? '-')
            .replace(/{{COMBINED_ACTIVATION}}/g, esim.combined_activation ?? '-')
            .replace(/{{APN_NAME}}/g, esim.apn_name ?? '-')
            .replace(/{{APN_USERNAME}}/g, esim.apn_username ?? '-')
            .replace(/{{APN_PASSWORD}}/g, esim.apn_password ?? '-');
    }

    private async generatePdf(
        html: string,
        outputPath: string
    ): Promise<void> {

        let browser: Browser | null = null;

        try {
            browser = await chromium.launch({ headless: true });

            const page = await browser.newPage();

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
