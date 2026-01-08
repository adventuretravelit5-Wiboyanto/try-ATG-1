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

    /**
     * Initialize and start the worker
     */
    async start(): Promise<void> {
        validateConfig();

        await this.smtpService.verify().catch(() => {
            console.warn('⚠️ SMTP not ready');
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

    private async processEmail(event: {
        seqno: number;
        mail: ParsedMail;
    }): Promise<void> {
        const { seqno, mail } = event;

        console.log('📨 Processing email...');

        try {
            /**
             * 1️⃣ Parse email → Order
             */
            const order = parseGlobalTixEmail(mail);

            if (!order) {
                console.warn('⚠️ Email ignored (not GlobalTix)');
                return;
            }

            if (!order.items.length) {
                console.warn(
                    `⚠️ Order ${order.referenceNumber} has no items, skipped`
                );
                return;
            }

            /**
             * 2️⃣ Save to DB
             */
            await this.orderRepository.insertOrder(order);

            /**
             * 3️⃣ Optional: Issue eSIM
             */
            for (const item of order.items) {
                await this.esimService.issueEsim({
                    sku: item.sku,
                    quantity: item.quantity,
                    customerName: order.customerName,
                    customerEmail: order.customerEmail,
                    referenceNumber: order.referenceNumber
                });
            }

            /**
             * 4️⃣ Optional: Send confirmation email
             */
            await this.smtpService.sendCustomerEmail(order);

            /**
             * 5️⃣ Mark email as read
             */
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

    /**
     * Graceful shutdown
     */
    stop(): void {
        console.log('🛑 Stopping Gmail Worker...');
        this.imapService.disconnect();
    }
}

/**
 * Bootstrap
 */
const worker = new GmailWorker();

process.on('SIGINT', () => worker.stop());
process.on('SIGTERM', () => worker.stop());

worker.start().catch(err => {
    console.error('❌ Worker failed to start:', err);
});
