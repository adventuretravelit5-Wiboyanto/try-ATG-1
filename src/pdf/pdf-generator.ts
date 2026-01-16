import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

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

export class PdfGenerator {

  private templatePath = path.join(
    process.cwd(),
    'src/pdf/templates/esim-pdf.html'
  );

  async generate(
    data: EsimPdfData,
    outputPath: string
  ): Promise<void> {

    /* ================= LOAD TEMPLATE ================= */

    let html = await fs.readFile(this.templatePath, 'utf-8');

    /* ================= INJECT DATA ================= */

    Object.entries(data).forEach(([key, value]) => {
      html = html.replace(
        new RegExp(`{{${key}}}`, 'g'),
        value ?? '-'
      );
    });

    /* ================= RENDER PDF ================= */

    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'load' });

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true
    });

    await browser.close();
  }
}
