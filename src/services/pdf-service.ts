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

export type EsimPdfData = {
  product_name: string;
  valid_from: string | null;
  valid_until: string | null;
  qr_code: string;
  iccid: string;
  smdp_address: string;
  activation_code: string;
  combined_activation: string;
  apn_name?: string | null;
  apn_username?: string | null;
  apn_password?: string | null;
};

/* ======================================================
 * SERVICE
 * ====================================================== */

export class PdfService {

  private readonly esimRepo = new EsimRepository();

  private readonly templatePath = path.resolve(
    process.cwd(),
    'src/pdf/templates/esim-pdf.html'
  );

  private readonly outputDir = path.resolve(
    process.cwd(),
    'data/pdf'
  );

  /* ======================================================
   * PUBLIC API
   * ====================================================== */

  async generatePdfByEsimId(
    esimId: string,
    options?: { force?: boolean }
  ): Promise<GeneratePdfResult> {

    const esim = await this.esimRepo.findById(esimId);

    if (!esim) {
      throw new Error(`eSIM not found: ${esimId}`);
    }

    if (!options?.force && esim.status !== 'COMPLETED') {
      throw new Error(
        `PDF generation blocked. Status=${esim.status}`
      );
    }

    await ensureDirExists(this.outputDir);

    const fileName =
      `${esim.reference_number}_${esim.iccid}.pdf`;

    const pdfPath =
      path.join(this.outputDir, fileName);

    const pdfData: EsimPdfData = {
      product_name: esim.product_name,
      valid_from: esim.valid_from,
      valid_until: esim.valid_until,
      qr_code: esim.qr_code,
      iccid: esim.iccid,
      smdp_address: esim.smdp_address,
      activation_code: esim.activation_code,
      combined_activation: esim.combined_activation,
      apn_name: esim.apn_name,
      apn_username: esim.apn_username,
      apn_password: esim.apn_password
    };

    await this.generatePdf(pdfData, pdfPath);

    return { pdfPath, fileName };
  }

  /* ======================================================
   * INTERNALS
   * ====================================================== */

  /**
   * Template contract:
   * {{PRODUCT_NAME}}, {{VALID_FROM}}, {{VALID_UNTIL}}, {{ICCID}}, ...
   */
  private async renderTemplate(
    data: EsimPdfData
  ): Promise<string> {

    let html = await fs.readFile(this.templatePath, 'utf-8');

    Object.entries(data).forEach(([key, value]) => {
      html = html.replace(
        new RegExp(`{{${key.toUpperCase()}}}`, 'g'),
        value ?? '-'
      );
    });

    return html;
  }

  private async generatePdf(
    data: EsimPdfData,
    outputPath: string
  ): Promise<void> {

    let browser: Browser | null = null;

    try {
      const html = await this.renderTemplate(data);

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

    } catch (err: any) {
      throw new Error(
        `PDF generation failed: ${err?.message ?? err}`
      );
    } finally {
      if (browser) await browser.close();
    }
  }
}
