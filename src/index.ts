import { ImapService } from './services/imap-service';
import { EmailParser } from './services/email-parser';
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

class GmailWorker {
    private imapService: ImapService;
    private emailParser: EmailParser;
    private smtpService: SmtpService;
    private esimService: EsimService;
    private orderRepository: OrderRepository;

    constructor() {
        this.imapService = new ImapService(imapConfig, emailFilter);
        this.emailParser = new EmailParser();
        this.smtpService = new SmtpService(smtpConfig);
        this.esimService = new EsimService(esimConfig);
        this.orderRepository = new OrderRepository();
    }

    /**
     * Initialize and start the worker
     */
    async start(): Promise<void> {
        try {
            console.log('='.repeat(60));
            console.log('🚀 Gmail Worker for GlobalTix Automation');
            console.log('='.repeat(60));
            console.log('');

            // Validate configuration
            console.log('📋 Validating configuration...');
            validateConfig();
            console.log('✓ Configuration valid\n');

            // Verify SMTP connection
            console.log('📧 Verifying SMTP connection...');
            try {
                await this.smtpService.verify();
                console.log('✓ SMTP ready\n');
            } catch (error) {
                console.warn('⚠️ SMTP verification failed:', error);
                console.warn('Emails may fail to send until the issue is resolved.\n');
            }

            // Connect to IMAP
            console.log('📬 Connecting to IMAP server...');
            await this.imapService.connect();
            console.log('');

            // Setup event handlers
            this.setupEventHandlers();

            // Start monitoring inbox
            this.imapService.monitorInbox();

            console.log('='.repeat(60));
            console.log('✓ Worker is running and monitoring inbox');
            console.log('  Press Ctrl+C to stop');
            console.log('='.repeat(60));
            console.log('');

        } catch (error) {
            console.error('❌ Failed to start worker:', error);
            process.exit(1);
        }
    }

    /**
     * Setup event handlers
     */
    private setupEventHandlers(): void {
        this.imapService.on('email', async (data) => {
            try {
                await this.processEmail(data);
            } catch (error) {
                console.error('❌ Error processing email:', error);
            }
        });

        this.imapService.on('error', (error: Error) => {
            console.error('IMAP error:', error.message);
        });

        this.imapService.on('disconnected', () => {
            console.warn('⚠️ IMAP disconnected');
        });
    }

    /**
     * Main email processing pipeline
     */
    private async processEmail(data: {
        seqno: number;
        parsed: any;
        body: string;
    }): Promise<void> {
        const { seqno, body } = data;

        console.log('\n' + '='.repeat(60));
        console.log('📨 Processing Email');
        console.log('='.repeat(60));

        try {
            /**
             * STEP 1: Parse email
             */
            console.log('\n[1/5] Parsing email...');
            const order = this.emailParser.parseGlobalTixEmail(body);

            if (!order) {
                console.error('✗ Failed to parse email - invalid format');
                return;
            }

            console.log('✓ Email parsed successfully');
            console.log(this.emailParser.formatOrderSummary(order));

            /**
             * STEP 2: Save order to PostgreSQL
             */
            console.log('\n[2/5] Saving order to database...');
            await this.orderRepository.insertOrder(order);
            console.log('✓ Order saved to database');

            /**
             * STEP 3: Issue eSIM
             */
            console.log('\n[3/5] Issuing eSIM...');
            const esimResults: {
                codes: string[];
                qrCodes: string[];
            }[] = [];

            for (const item of order.items) {
                const esimResponse = await this.esimService.issueEsim({
                    sku: item.sku,
                    quantity: item.quantity,
                    customerName: order.customerName,
                    customerEmail: order.customerEmail,
                    referenceNumber: order.referenceNumber
                });

                if (esimResponse.success) {
                    esimResults.push({
                        codes: esimResponse.esimCodes || [],
                        qrCodes: esimResponse.qrCodes || []
                    });
                } else {
                    console.error(
                        `✗ Failed to issue eSIM for ${item.sku}:`,
                        esimResponse.error
                    );
                }
            }

            /**
             * STEP 4: Send email to customer
             */
            console.log('\n[4/5] Sending email to customer...');
            const esimData = esimResults.length
                ? {
                      codes: esimResults.flatMap(r => r.codes),
                      qrCodes: esimResults.flatMap(r => r.qrCodes)
                  }
                : undefined;

            const emailSent = await this.smtpService.sendCustomerEmail(
                order,
                esimData
            );

            if (!emailSent) {
                console.error('✗ Failed to send customer email');
                return;
            }

            /**
             * STEP 5: Mark email as read
             */
            if (workerConfig.markAsRead) {
                console.log('\n[5/5] Marking email as read...');
                await this.imapService.markAsRead(seqno);
            }

            console.log('\n' + '='.repeat(60));
            console.log('✅ Email processed successfully!');
            console.log('='.repeat(60));
            console.log('');

        } catch (error) {
            console.error('\n❌ Error processing email:', error);
            console.log('='.repeat(60));
        }
    }

    /**
     * Graceful shutdown
     */
    stop(): void {
        console.log('\n🛑 Stopping worker...');
        this.imapService.disconnect();
        console.log('✓ Worker stopped');
    }
}

/**
 * Bootstrap
 */
const worker = new GmailWorker();

process.on('SIGINT', () => {
    worker.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    worker.stop();
    process.exit(0);
});

worker.start().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
