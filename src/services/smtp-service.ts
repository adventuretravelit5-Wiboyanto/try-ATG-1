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

    /**
     * Verify SMTP connection
     */
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

    /**
     * Send email to customer with order details
     */
    async sendCustomerEmail(
        order: GlobalTixOrder,
        esimData?: { codes: string[]; qrCodes: string[] }
    ): Promise<boolean> {
        try {
            const htmlContent = this.generateEmailHtml(order, esimData);

            const mailOptions = {
                from: `"${this.config.from.name}" <${this.config.from.email}>`,
                to: order.customerEmail,
                cc: order.alternateEmail || undefined,
                subject: `eSIM Activation - Order ${order.referenceNumber}`,
                html: htmlContent,
                // attachments can be added here for PDFs
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('✓ Email sent successfully');
            console.log(`  Message ID: ${info.messageId}`);
            console.log(`  To: ${order.customerEmail}`);

            return true;
        } catch (error) {
            console.error('✗ Failed to send email:', error);
            return false;
        }
    }

    /**
     * Generate HTML email content
     */
    private generateEmailHtml(
        order: GlobalTixOrder,
        esimData?: { codes: string[]; qrCodes: string[] }
    ): string {
        const templatePath = path.join(__dirname, '../templates/customer-email.html');

        let template: string;
        try {
            template = fs.readFileSync(templatePath, 'utf-8');
        } catch (error) {
            // Fallback to inline template if file not found
            template = this.getDefaultTemplate();
        }

        // Replace placeholders
        let html = template
            .replace(/\{\{customerName\}\}/g, order.customerName)
            .replace(/\{\{referenceNumber\}\}/g, order.referenceNumber)
            .replace(/\{\{purchaseDate\}\}/g, order.purchaseDate)
            .replace(/\{\{mobileNumber\}\}/g, order.mobileNumber);

        // Generate items HTML
        const itemsHtml = order.items.map((item, idx) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${idx + 1}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <strong>${item.productName}</strong><br>
          <small style="color: #666;">${item.variant}</small>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.sku}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.confirmationCode}</td>
      </tr>
    `).join('');

        html = html.replace('{{itemsTable}}', itemsHtml);

        // Add eSIM data if available
        if (esimData && esimData.codes.length > 0) {
            const esimHtml = `
        <div style="margin-top: 30px; padding: 20px; background: #f0f9ff; border-radius: 8px;">
          <h3 style="color: #0369a1; margin-top: 0;">eSIM Activation Details</h3>
          ${esimData.codes.map((code, idx) => `
            <div style="margin: 15px 0; padding: 15px; background: white; border-radius: 6px;">
              <p style="margin: 5px 0;"><strong>eSIM Code ${idx + 1}:</strong> <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${code}</code></p>
            </div>
          `).join('')}
        </div>
      `;
            html = html.replace('{{esimDetails}}', esimHtml);
        } else {
            html = html.replace('{{esimDetails}}', '');
        }

        return html;
    }

    /**
     * Default email template (fallback)
     */
    private getDefaultTemplate(): string {
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>eSIM Activation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0;">Global Komunika</h1>
    <p style="color: #f0f0f0; margin: 10px 0 0 0;">eSIM Activation Confirmation</p>
  </div>
  
  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p>Dear <strong>{{customerName}}</strong>,</p>
    
    <p>Thank you for your purchase! Your eSIM order has been processed successfully.</p>
    
    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #374151;">Order Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Reference Number:</td>
          <td style="padding: 8px 0;"><strong>{{referenceNumber}}</strong></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Purchase Date:</td>
          <td style="padding: 8px 0;">{{purchaseDate}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Mobile Number:</td>
          <td style="padding: 8px 0;">{{mobileNumber}}</td>
        </tr>
      </table>
    </div>
    
    <h3 style="color: #374151;">Items Purchased</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">#</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Product</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">SKU</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Qty</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Code</th>
        </tr>
      </thead>
      <tbody>
        {{itemsTable}}
      </tbody>
    </table>
    
    {{esimDetails}}
    
    <div style="margin-top: 30px; padding: 20px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
      <p style="margin: 0;"><strong>Important:</strong> Please keep this email for your records. You may need the confirmation codes for activation.</p>
    </div>
    
    <p style="margin-top: 30px;">If you have any questions, please don't hesitate to contact us.</p>
    
    <p>Best regards,<br><strong>Global Komunika Team</strong></p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; padding: 20px; color: #6b7280; font-size: 12px;">
    <p>This is an automated email. Please do not reply to this message.</p>
    <p>&copy; 2026 Global Komunika. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();
    }
}
