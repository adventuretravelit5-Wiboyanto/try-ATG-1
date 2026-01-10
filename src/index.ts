import { ImapService } from './services/imap-service';
import { parseGlobalTixEmail } from './parsers/globaltix-email.parser';
import { SmtpService } from './services/smtp-service';
import { EsimService } from './services/esim-service';
import {
    imapConfig,
    smtpConfig,
    emailFilter,
    workerConfig,
    esimConfig,
    validateConfig
} from './config';
import { OrderRepository } from './db/order.repository';
import { ParsedMail } from 'mailparser';

class GmailWorker {
    private imapService: ImapService;
    private smtpService: SmtpService;
    private esimService: EsimService;
    private orderRepository: OrderRepository;

    constructor() {
        this.imapService = new ImapService(imapConfig, emailFilter);
        this.smtpService = new SmtpService(smtpConfig);
        this.esimService = new EsimService(esimConfig);
        this.orderRepository = new OrderRepository();
    }

    /* =======================================================
     * START WORKER
     * ======================================================= */

    async start(): Promise<void> {
        validateConfig();

        await this.smtpService.verify().catch(err => {
            console.warn('⚠️ SMTP not ready:', err?.message);
        });

        await this.imapService.connect();
        this.setupEventHandlers();
        this.imapService.monitorInbox();

        console.log('✅ Gmail Worker running...');
    }

    private setupEventHandlers(): void {
        this.imapService.on('email', async (event) => {
            await this.processEmail(event);
        });

        this.imapService.on('error', (err) => {
            console.error('❌ IMAP error:', err);
        });
    }

    /* =======================================================
     * PROCESS EMAIL
     * ======================================================= */

    private async processEmail(event: {
        seqno: number;
        mail: ParsedMail;
    }): Promise<void> {
        const { seqno, mail } = event;

        console.log(`📨 Processing email (seqno=${seqno})`);

        try {
            /* 1️⃣ Parse email */
            const order = parseGlobalTixEmail(mail);

            if (!order) {
                console.log('ℹ️ Email ignored (not GlobalTix)');
                return;
            }

            if (!order.items.length) {
                console.warn(
                    `⚠️ Order ${order.referenceNumber} has no items`
                );
                return;
            }

            /* 2️⃣ Save / Update order (UPSERT) */
            await this.orderRepository.upsertOrder(order);

            console.log(
                `💾 Order upserted: ${order.referenceNumber}`
            );

            /* 3️⃣ Issue eSIM (best effort per item) */
            for (const item of order.items) {
                try {
                    await this.esimService.issueEsim({
                        sku: item.sku,
                        quantity: item.quantity,
                        customerName: order.customerName,
                        customerEmail: order.customerEmail,
                        referenceNumber: order.referenceNumber
                    });
                } catch (err) {
                    console.error(
                        `❌ eSIM failed for SKU ${item.sku}:`,
                        err
                    );
                }
            }

            /* 4️⃣ Send confirmation email (non-fatal) */
            try {
                await this.smtpService.sendCustomerEmail(order);
            } catch (err) {
                console.error(
                    `❌ Failed sending email for ${order.referenceNumber}:`,
                    err
                );
            }

            /* 5️⃣ Mark email as read */
            if (workerConfig.markAsRead) {
                await this.imapService.markAsRead(seqno);
            }

            console.log(
                `✅ Email processed (${order.referenceNumber})`
            );

        } catch (err) {
            console.error(
                `❌ Failed processing email seqno=${seqno}:`,
                err
            );
        }
    }

    /* =======================================================
     * SHUTDOWN
     * ======================================================= */

    stop(): void {
        console.log('🛑 Stopping Gmail Worker...');
        this.imapService.disconnect();
    }
}

/* =======================================================
 * BOOTSTRAP
 * ======================================================= */

const worker = new GmailWorker();

process.on('SIGINT', () => worker.stop());
process.on('SIGTERM', () => worker.stop());

worker.start().catch(err => {
    console.error('❌ Worker failed to start:', err);
});
