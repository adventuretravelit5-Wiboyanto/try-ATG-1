import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { EventEmitter } from 'events';
import { ImapConfig, EmailFilter } from '../types';

export class ImapService extends EventEmitter {
    private imap: Imap;
    private config: ImapConfig;
    private filter: EmailFilter;

    private isConnected = false;
    private isInboxOpen= false;

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
        this.imap.on('ready', async () => {
            console.log('✓ IMAP connection ready');
            this.isConnected = true;

            try {
                await this.openInbox();
                this.emit('ready');
            } catch (err) {
                this.emit('error', err);
            }
        });

        this.imap.on('error', (err: Error) => {
            console.error('✗ IMAP error:', err.message);
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

    /**
     * Connect to IMAP server
     */
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isConnected) return resolve();

            console.log(
                `Connecting to IMAP server ${this.config.host}:${this.config.port}...`
            );
            
            this.once('ready', () => resolve());
            this.once('error', reject);

            this.imap.connect();
        });
    }

    /**
     * Open inbox folder
     */
    private openInbox(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.imap.openBox('INBOX', false, (err, box) => {
            if (err) {
                console.error('Error opening inbox:', err);
                reject(err);
            }
            console.log(
                `✓ Inbox opened (status: ${this.imap.state}). Total messages: ${box.messages.total}`
            );

            this.isInboxOpen = true;
            resolve();
            });
        });
    }

    /**
     * Monitor inbox for new emails
     */
    monitorInbox(): void {
        if (!this.isConnected || !this.isInboxOpen) {
            throw new Error(
                'IMAP not ready. Connect and open inbox first.'
            );
        }

        console.log('Monitoring inbox for new emails...');
        console.log(
            `Filter: From="${this.filter.from}", Subject contains="${this.filter.subject}"`
        );

        // New mail event
        this.imap.on('mail', (numNewMsgs: number) => {
            console.log(`\n📧 ${numNewMsgs} new email(s) received`);
            this.fetchUnreadEmails();
        });

        // Initial scan
        this.fetchUnreadEmails();
    }

    /**
     * Fetch unread emails matching filter
     */
    private fetchUnreadEmails(): void {
        if (!this.isInboxOpen) {
            console.warn('Inbox not open yet, skipping fetch');
            return;
        }

        // Defensive check for IMAP state if accessible, or just logging
        // Note: 'state' property might not be public in all type definitions but exists at runtime
        const state = (this.imap as any).state;
        if (state && state !== 'authenticated') {
            // specifically 'authenticated' is when we are logged in but no box selected? 
            // Actually, when box is open, state should be 'selected'. 
            // Let's log it to be sure.
            console.log(`Debug: IMAP State is '${state}'`);
        }

        console.log('Searching for unread emails...');

        try {
            this.imap.search(['UNSEEN'], (err, results) => {
                if (err) {
                    console.error('Search error:', err);
                    if (err.message.includes('No mailbox is currently selected')) {
                        console.warn('Attempting to re-open inbox...');
                        this.isInboxOpen = false;
                        this.openInbox().then(() => this.fetchUnreadEmails()).catch(e => console.error('Re-open failed', e));
                    }
                    return;
                }

                if (!results || results.length === 0) {
                    console.log('No unread emails found');
                    return;
                }

                console.log(`Found ${results.length} unread email(s)`);

                const fetch = this.imap.fetch(results, {
                    bodies: '',
                    markSeen: false
                });

                fetch.on('message', (msg, seqno) => {
                    msg.on('body', async (stream) => {
                        try {
                            const parsed = await simpleParser(stream as any);

                            if (this.matchesFilter(parsed)) {
                                console.log(`\n✓ Email matches filter`);
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
        } catch (error) {
            console.error('Synchronous search error:', error);
        }
    }

    /**
     * Filter logic
     */
    private matchesFilter(email: ParsedMail): boolean {
        const fromAddress =
            email.from?.value?.[0]?.address?.toLowerCase() || '';
        const subject = (email.subject || '').toLowerCase();

        return (
            fromAddress.includes(this.filter.from.toLowerCase()) &&
            subject.includes(this.filter.subject.toLowerCase())
        );
    }

    /**
     * Mark email as read
     */
    markAsRead(seqno: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.imap.addFlags(seqno, ['\\Seen'], (err) => {
                if (err) return reject(err);

                console.log(`✓ Marked email ${seqno} as read`);
                resolve();
            });
        });
    }

    /**
     * Disconnect
     */
    disconnect(): void {
        if (this.isConnected) {
            this.imap.end();
        }
    }
}
