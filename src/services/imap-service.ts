import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { EventEmitter } from 'events';
import { ImapConfig, EmailFilter } from '../types/index';

/**
 * Payload event email yang dikirim ke worker
 * HARUS sinkron dengan index.ts
 */
export interface ImapEmailEvent {
    seqno: number;
    mail: ParsedMail;
}

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
        this.setupEventHandlers();
    }

    /* ------------------------------------------------------------------ */
    /* IMAP CORE EVENTS                                                    */
    /* ------------------------------------------------------------------ */

    private setupEventHandlers(): void {
        this.imap.on('ready', () => {
            console.log('✓ IMAP connection ready');
            this.isConnected = true;
            this.openInbox();
        });

        this.imap.on('mail', (numNew) => {
            console.log(`📧 ${numNew} new email(s) received`);
            this.fetchUnreadEmails();
        });

        this.imap.on('error', (err) => {
            console.error('✗ IMAP error:', err);
            this.isConnected = false;
            this.isInboxOpen = false;
            this.emit('error', err);
        });

        this.imap.on('end', () => {
            console.log('IMAP connection ended');
            this.isConnected = false;
            this.isInboxOpen = false;
            this.emit('disconnected');
        });
    }

    /* ------------------------------------------------------------------ */
    /* CONNECTION                                                         */
    /* ------------------------------------------------------------------ */

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isConnected) return resolve();

            this.once('ready', resolve);
            this.once('error', reject);

            console.log('Connecting to IMAP server...');
            this.imap.connect();
        });
    }

    private openInbox(): void {
        this.imap.openBox('INBOX', false, (err, box) => {
            if (err) {
                console.error('Error opening inbox:', err);
                return;
            }

            this.isInboxOpen = true;
            console.log(`✓ Inbox opened (${box.messages.total} messages)`);
            this.emit('ready');

            // Initial fetch
            this.fetchUnreadEmails();
        });
    }

    monitorInbox(): void {
        if (!this.isConnected || !this.isInboxOpen) {
            throw new Error('IMAP not ready. Call connect() first.');
        }

        console.log('Monitoring inbox...');
        console.log(
            `Filter → From="${this.filter.from}", Subject="${this.filter.subject}"`
        );

        this.fetchUnreadEmails();
    }

    /* ------------------------------------------------------------------ */
    /* FETCH EMAILS                                                       */
    /* ------------------------------------------------------------------ */

    private fetchUnreadEmails(): void {
        if (!this.isInboxOpen || this.fetching) return;
        this.fetching = true;

        const criteria: any[] = ['UNSEEN'];

        if (this.filter.from) {
            criteria.push(['FROM', this.filter.from]);
        }

        if (this.filter.subject) {
            criteria.push(['SUBJECT', this.filter.subject]);
        }

        this.imap.search(criteria, (err, results) => {
            if (err) {
                console.error('Search error:', err);
                this.fetching = false;
                return;
            }

            if (!results || results.length === 0) {
                this.fetching = false;
                return;
            }

            console.log(`✓ Found ${results.length} unread email(s)`);

            const fetch = this.imap.fetch(results, {
                bodies: '',
                markSeen: false
            });

            fetch.on('message', (msg, seqno) => {
                msg.on('body', async (stream) => {
                    try {
                        const parsed = await simpleParser(stream as any);

                        if (this.matchesFilter(parsed)) {
                            this.emit('email', {
                                seqno,
                                mail: parsed
                            } as ImapEmailEvent);
                        }
                    } catch (error) {
                        console.error('Email parsing error:', error);
                    }
                });
            });

            fetch.once('error', (err) => {
                console.error('Fetch error:', err);
            });

            fetch.once('end', () => {
                this.fetching = false;
            });
        });
    }

    /* ------------------------------------------------------------------ */
    /* FILTER                                                             */
    /* ------------------------------------------------------------------ */

    private matchesFilter(email: ParsedMail): boolean {
        const from =
            email.from?.value?.[0]?.address?.toLowerCase() || '';
        const subject = (email.subject || '').toLowerCase();

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

    /* ------------------------------------------------------------------ */
    /* ACTIONS                                                            */
    /* ------------------------------------------------------------------ */

    markAsRead(seqno: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.imap.addFlags(seqno, ['\\Seen'], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    disconnect(): void {
        if (this.isConnected) {
            this.imap.end();
        }
    }
}


