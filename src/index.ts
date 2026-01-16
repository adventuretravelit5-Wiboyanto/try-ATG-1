import { ImapService, ImapEmailEvent } from './services/imap-service';
import { parseGlobalTixEmail } from './parsers/globaltix-email.parser';
import { SmtpService } from './services/smtp-service';
import { EsimService } from './services/esim-service';
import { ThirdPartyService } from './services/third-party.service';

import {
    imapConfig,
    smtpConfig,
    emailFilter,
    workerConfig,
    esimConfig,
    validateConfig
} from './config';

import { env } from './config/env';

/* ======================================================
 * WORKER
 * ====================================================== */

export class GmailWorker {

    private readonly imapService: ImapService;
    private readonly smtpService: SmtpService;
    private readonly esimService: EsimService;
    private readonly thirdPartyService: ThirdPartyService;

    private shuttingDown = false;

    constructor() {
        /* ======================================================
         * VALIDATE ENV & CONFIG
         * ====================================================== */
        validateConfig();

        /* ======================================================
         * INIT SERVICES
         * ====================================================== */
        this.imapService = new ImapService(imapConfig, emailFilter);
        this.smtpService = new SmtpService(smtpConfig);
        this.esimService = new EsimService(esimConfig);

        this.thirdPartyService = new ThirdPartyService({
            baseUrl: env.THIRD_PARTY_BASE_URL,
            apiKey: env.THIRD_PARTY_API_KEY,
            timeoutMs: 15_000
        });
    }

    /* ======================================================
     * START WORKER
     * ====================================================== */

    async start(): Promise<void> {
        console.log('🚀 Gmail Worker starting (GlobalTix)');

        await this.imapService.connect();
        this.setupEventHandlers();
        this.imapService.monitorInbox();

        console.log('✅ Gmail Worker RUNNING');
    }

    /* ======================================================
     * EVENT HANDLERS
     * ====================================================== */

    private setupEventHandlers(): void {
        this.imapService.on(
            'email',
            (event: ImapEmailEvent) => {
                if (this.shuttingDown) return;

                this.processEmail(event).catch(err => {
                    console.error('❌ Email processing failed:', err);
                });
            }
        );

        this.imapService.on('error', err => {
            console.error('❌ IMAP error:', err);
        });
    }

    /* ======================================================
     * CORE FLOW
     * ====================================================== */

    private async processEmail(
        event: ImapEmailEvent
    ): Promise<void> {

        const { uid, mail } = event;
        console.log(`📨 Processing email UID=${uid}`);

        const order = parseGlobalTixEmail(mail);
        if (!order) {
            console.warn('⚠️ Not a GlobalTix email');
            return;
        }

        /* ======================================================
         * 🔥 PUSH TO THIRD-PARTY (ITEM LEVEL IDEMPOTENT)
         * ====================================================== */

        for (const item of order.items) {
            await this.thirdPartyService.sendOrderByConfirmationCode(
                item.confirmationCode
            );
        }

        /* ======================================================
         * ✅ MARK EMAIL AS READ (LAST STEP)
         * ====================================================== */

        if (workerConfig.markAsRead) {
            await this.imapService.markAsRead(uid);
        }

        console.log(
            `✅ DONE | reference=${order.referenceNumber}`
        );
    }

    /* ======================================================
     * SHUTDOWN
     * ====================================================== */

    stop(): void {
        if (this.shuttingDown) return;
        this.shuttingDown = true;

        console.log('🛑 Shutting down worker...');
        this.imapService.disconnect();
    }
}

/* ======================================================
 * BOOTSTRAP (ONLY WHEN RUN DIRECTLY)
 * ====================================================== */

if (require.main === module) {
    const worker = new GmailWorker();

    process.on('SIGINT', () => worker.stop());
    process.on('SIGTERM', () => worker.stop());

    worker.start().catch(err => {
        console.error('❌ Worker failed to start:', err);
        process.exit(1);
    });
}
