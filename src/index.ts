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

class GmailWorker {

    private readonly imapService: ImapService;
    private readonly smtpService: SmtpService;
    private readonly esimService: EsimService;
    private readonly thirdPartyService: ThirdPartyService;

    private shuttingDown = false;

    constructor() {
        validateConfig();

        this.imapService = new ImapService(imapConfig, emailFilter);
        this.smtpService = new SmtpService(smtpConfig);
        this.esimService = new EsimService(esimConfig);

        /* ✅ PASS CONFIG CORRECTLY */
        this.thirdPartyService = new ThirdPartyService({
            baseUrl: process.env.THIRD_PARTY_API_BASE_URL!,
            apiKey: process.env.THIRD_PARTY_API_KEY!,
            timeoutMs: 15_000
        });
    }

    async start(): Promise<void> {
        console.log('🚀 Gmail Worker starting (GlobalTix)');

        await this.imapService.connect();
        this.setupEventHandlers();
        this.imapService.monitorInbox();

        console.log('✅ Gmail Worker RUNNING');
    }

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
    }

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
         * 🔥 PUSH TO THIRD-PARTY (IDEMPOTENT)
         * ====================================================== */
        for (const item of order.items) {
            await this.thirdPartyService
                .sendOrderByConfirmationCode(
                    item.confirmationCode
                );
        }

        if (workerConfig.markAsRead) {
            await this.imapService.markAsRead(uid);
        }

        console.log(
            `✅ DONE | reference=${order.referenceNumber}`
        );
    }

    stop(): void {
        if (this.shuttingDown) return;
        this.shuttingDown = true;

        console.log('🛑 Shutting down worker...');
        this.imapService.disconnect();
    }
}

/* ======================================================
 * BOOTSTRAP
 * ====================================================== */

const worker = new GmailWorker();

process.on('SIGINT', () => worker.stop());
process.on('SIGTERM', () => worker.stop());

worker.start().catch(err => {
    console.error('❌ Worker failed to start:', err);
    process.exit(1);
});
