import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { EventEmitter } from 'events';
import { ImapConfig, EmailFilter } from '../types';

export class ImapService extends EventEmitter {
    private imap: Imap;
    private config: ImapConfig;
    private filter: EmailFilter;
    private isConnected: boolean = false;

    constructor(config: ImapConfig, filter: EmailFilter) {
        super();
        this.config = config;
        this.filter = filter;
        this.imap = new Imap(config);
        this.setupEventHandlers();
    }

    /**
     * Setup IMAP event handlers
     */
    private setupEventHandlers(): void {
        this.imap.once('ready', () => {
            console.log('✓ IMAP connection ready');
            this.isConnected = true;
            this.openInbox();
        });

        this.imap.once('error', (err: Error) => {
            console.error('✗ IMAP error:', err.message);
            this.isConnected = false;
            this.emit('error', err);
        });

        this.imap.once('end', () => {
            console.log('IMAP connection ended');
            this.isConnected = false;
            this.emit('disconnected');
        });
    }

    /**
     * Connect to IMAP server
     */
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isConnected) {
                resolve();
                return;
            }

            console.log(`Connecting to IMAP server: ${this.config.host}:${this.config.port}`);

            this.imap.once('ready', () => resolve());
            this.imap.once('error', (err: Error) => reject(err));

            this.imap.connect();
        });
    }

    /**
     * Open inbox folder
     */
    private openInbox(): void {
        this.imap.openBox('INBOX', false, (err, box) => {
            if (err) {
                console.error('Error opening inbox:', err);
                this.emit('error', err);
                return;
            }
            console.log(`✓ Inbox opened (${box.messages.total} messages)`);
            this.emit('ready');
        });
    }

    /**
     * Monitor inbox for new emails
     */
    monitorInbox(): void {
        if (!this.isConnected) {
            console.error('Not connected to IMAP server');
            return;
        }

        console.log('Monitoring inbox for new emails...');
        console.log(`Filter: From="${this.filter.from}", Subject contains="${this.filter.subject}"`);

        this.imap.on('mail', (numNewMsgs: number) => {
            console.log(`\n📧 ${numNewMsgs} new email(s) received`);
            this.fetchUnreadEmails();
        });

        // Also check for existing unread emails on start
        this.fetchUnreadEmails();
    }

    /**
     * Fetch unread emails matching filter
     */
    private fetchUnreadEmails(): void {
        this.imap.search(['UNSEEN'], (err, results) => {
            if (err) {
                console.error('Error searching emails:', err);
                return;
            }

            if (!results || results.length === 0) {
                console.log('No unread emails found');
                return;
            }

            console.log(`Found ${results.length} unread email(s), checking filters...`);

            const fetch = this.imap.fetch(results, {
                bodies: '',
                markSeen: false
            });

            fetch.on('message', (msg, seqno) => {
                msg.on('body', async (stream) => {
                    try {
                        const parsed = await simpleParser(stream as any);

                        // Check if email matches filter
                        if (this.matchesFilter(parsed)) {
                            console.log(`\n✓ Email matches filter (seq: ${seqno})`);
                            console.log(`  From: ${parsed.from?.text}`);
                            console.log(`  Subject: ${parsed.subject}`);

                            this.emit('email', {
                                seqno,
                                parsed,
                                body: parsed.text || parsed.html || ''
                            });
                        }
                    } catch (err) {
                        console.error('Error parsing email:', err);
                    }
                });
            });

            fetch.once('error', (err) => {
                console.error('Fetch error:', err);
            });

            fetch.once('end', () => {
                console.log('Finished fetching emails');
            });
        });
    }

    /**
     * Check if email matches filter criteria
     */
    private matchesFilter(email: ParsedMail): boolean {
        const fromAddress = email.from?.value[0]?.address || '';
        const subject = email.subject || '';

        const fromMatches = fromAddress.toLowerCase().includes(this.filter.from.toLowerCase());
        const subjectMatches = subject.toLowerCase().includes(this.filter.subject.toLowerCase());

        return fromMatches && subjectMatches;
    }

    /**
     * Mark email as read
     */
    markAsRead(seqno: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.imap.addFlags(seqno, ['\\Seen'], (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`✓ Marked email ${seqno} as read`);
                    resolve();
                }
            });
        });
    }

    /**
     * Disconnect from IMAP server
     */
    disconnect(): void {
        if (this.isConnected) {
            this.imap.end();
        }
    }

    /**
     * Check if connected
     */
    isReady(): boolean {
        return this.isConnected;
    }
}
