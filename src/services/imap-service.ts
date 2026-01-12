import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { EventEmitter } from 'events';
import { ImapConfig, EmailFilter } from '../types';

/* ======================================================
 * EVENT PAYLOAD
 * ====================================================== */

export interface ImapEmailEvent {
    uid: number;
    mail: ParsedMail;
}

/* ======================================================
 * SERVICE
 * ====================================================== */

export class ImapService extends EventEmitter {
    private imap: Imap;
    private filter: EmailFilter;

    private isConnected = false;
    private isInboxOpen = false;
    private fetching = false;

    constructor(config: ImapConfig, filter: EmailFilter) {
        super();
        this.filter = filter;
        this.imap = new Imap(config);
        this.setupCoreHandlers();
    }

    /* ======================================================
     * CORE EVENTS
     * ====================================================== */

    private setupCoreHandlers(): void {
        this.imap.on('ready', () => {
            console.log('✓ IMAP socket connected');
        });

        this.imap.on('mail', (numNew) => {
            console.log(`📧 ${numNew} new email(s)`);
            this.fetchUnreadEmails();
        });

        this.imap.on('error', (err) => {
            console.error('❌ IMAP error:', err);
            this.resetState();
            this.emit('error', err);
        });

        this.imap.on('end', () => {
            console.warn('⚠️ IMAP connection ended');
            this.resetState();
            this.emit('disconnected');
        });
    }

    private resetState(): void {
        this.isConnected = false;
        this.isInboxOpen = false;
        this.fetching = false;
    }

    /* ======================================================
     * CONNECTION
     * ====================================================== */

    async connect(): Promise<void> {
        if (this.isConnected) return;

        console.log('📬 Connecting to IMAP...');

        await new Promise<void>((resolve, reject) => {
            this.imap.once('ready', resolve);
            this.imap.once('error', reject);
            this.imap.connect();
        });

        this.isConnected = true;
        await this.openInbox();
    }

    private async openInbox(): Promise<void> {
        if (this.isInboxOpen) return;

        await new Promise<void>((resolve, reject) => {
            this.imap.openBox('INBOX', false, (err, box) => {
                if (err) return reject(err);

                this.isInboxOpen = true;
                console.log(
                    `📂 INBOX opened (${box.messages.total} messages)`
                );
                resolve();
            });
        });
    }

    /* ======================================================
     * MONITOR
     * ====================================================== */

    monitorInbox(): void {
        if (!this.isConnected || !this.isInboxOpen) {
            throw new Error(
                'IMAP not ready. Call connect() first.'
            );
        }

        console.log('👀 Monitoring inbox...');
        console.log(
            `Filter → from="${this.filter.from}", subject="${this.filter.subject}"`
        );

        this.fetchUnreadEmails();
    }

    /* ======================================================
     * FETCH
     * ====================================================== */

    private fetchUnreadEmails(): void {
        if (this.fetching || !this.isInboxOpen) return;
        this.fetching = true;

        const criteria: any[] = ['UNSEEN'];

        if (this.filter.from) {
            criteria.push(['FROM', this.filter.from]);
        }

        if (this.filter.subject) {
            criteria.push(['SUBJECT', this.filter.subject]);
        }

        this.imap.search(criteria, (err, uids) => {
            if (err) {
                console.error('❌ Search error:', err);
                this.fetching = false;
                return;
            }

            if (!uids?.length) {
                this.fetching = false;
                return;
            }

            console.log(`📨 ${uids.length} unread email(s)`);

            const fetch = this.imap.fetch(uids, {
                bodies: '',
                struct: true
            });

            fetch.on('message', (msg) => {
                let uid: number | undefined;

                msg.once('attributes', (attrs) => {
                    uid = attrs.uid;
                });

                msg.on('body', async (stream) => {
                    try {
                        const mail = await simpleParser(stream as any);

                        if (uid && this.matchesFilter(mail)) {
                            this.emit('email', {
                                uid,
                                mail
                            } as ImapEmailEvent);
                        }
                    } catch (err) {
                        console.error('❌ Parse error:', err);
                    }
                });
            });

            fetch.once('end', () => {
                this.fetching = false;
            });

            fetch.once('error', (err) => {
                console.error('❌ Fetch error:', err);
                this.fetching = false;
            });
        });
    }

    /* ======================================================
     * FILTER
     * ====================================================== */

    private matchesFilter(email: ParsedMail): boolean {
        const from =
            email.from?.value?.[0]?.address?.toLowerCase() ?? '';
        const subject =
            (email.subject || '').toLowerCase();

        if (
            this.filter.from &&
            !from.includes(this.filter.from.toLowerCase())
        ) {
            return false;
        }

        if (
            this.filter.subject &&
            !subject.includes(this.filter.subject.toLowerCase())
        ) {
            return false;
        }

        return true;
    }

    /* ======================================================
     * ACTIONS
     * ====================================================== */

    markAsRead(uid: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.imap.addFlags(uid, ['\\Seen'], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    disconnect(): void {
        if (this.isConnected) {
            console.log('📴 Closing IMAP connection...');
            this.imap.end();
        }
    }
}
