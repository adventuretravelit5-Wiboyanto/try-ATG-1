import nodemailer, { Transporter } from 'nodemailer';
import { SmtpConfig, GlobalTixOrder } from '../types';
import fs from 'fs';
import path from 'path';

export class SmtpService {
    private transporter: Transporter;
    private config: SmtpConfig;

    constructor(config: SmtpConfig) {
        this.config = config;
        this.transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: config.auth
        });
    }

    /* ======================================================
     * VERIFY
     * ====================================================== */
    async verify(): Promise<boolean> {
        try {
            await this.transporter.verify();
            console.log('✓ SMTP connection verified');
            return true;
        } catch (error) {
            console.error('✗ SMTP verification failed:', error);
            return false;
        }
    }

    /* ======================================================
     * DEV / TEST ONLY (SIMULATE INCOMING EMAIL)
     * ====================================================== */
    async sendRawMail(options: {
        from: string;
        to: string;
        subject: string;
        text?: string;
        html?: string;
    }): Promise<void> {
        await this.transporter.sendMail(options);
        console.log('📤 Dummy email sent:', options.subject);
    }

    /* ======================================================
     * PRODUCTION CUSTOMER EMAIL
     * ====================================================== */
    async sendCustomerEmail(
        order: GlobalTixOrder,
        esimData?: { codes: string[]; qrCodes: string[] }
    ): Promise<boolean> {
        try {
            const htmlContent = this.generateEmailHtml(order, esimData);

            const mailOptions = {
                from: `"${this.config.from.name}" <${this.config.from.email}>`,
                to: order.customerEmail,
                cc: order.alternativeEmail || undefined,
                subject: `eSIM Activation - Order ${order.referenceNumber}`,
                html: htmlContent
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('✓ Email sent successfully');
            console.log(`  Message ID: ${info.messageId}`);

            return true;
        } catch (error) {
            console.error('✗ Failed to send email:', error);
            return false;
        }
    }

    /* ======================================================
     * TEMPLATE
     * ====================================================== */
    private generateEmailHtml(
        order: GlobalTixOrder,
        esimData?: { codes: string[]; qrCodes: string[] }
    ): string {
        const templatePath = path.join(
            __dirname,
            '../templates/customer-email.html'
        );

        let template: string;
        try {
            template = fs.readFileSync(templatePath, 'utf-8');
        } catch {
            template = this.getDefaultTemplate();
        }

        let html = template
            .replace(/\{\{customerName\}\}/g, order.customerName)
            .replace(/\{\{referenceNumber\}\}/g, order.referenceNumber)
            .replace(
                /\{\{purchaseDate\}\}/g,
                order.purchaseDate
                    ? order.purchaseDate.toLocaleDateString('id-ID')
                    : '-'
            )
            .replace(/\{\{mobileNumber\}\}/g, order.mobileNumber ?? '-');

        const itemsHtml = order.items
            .map(
                (item, idx) => `
<tr>
  <td>${idx + 1}</td>
  <td>${item.productName}</td>
  <td>${item.sku}</td>
  <td>${item.quantity}</td>
  <td>${item.confirmationCode}</td>
</tr>`
            )
            .join('');

        html = html.replace('{{itemsTable}}', itemsHtml);
        html = html.replace('{{esimDetails}}', '');

        return html;
    }

    private getDefaultTemplate(): string {
        return `
<!DOCTYPE html>
<html>
<body>
  <h2>eSIM Activation</h2>
  <p>Customer: {{customerName}}</p>
  <p>Reference: {{referenceNumber}}</p>
  <table>
    {{itemsTable}}
  </table>
</body>
</html>
        `.trim();
    }
}
