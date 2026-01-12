import { ParsedMail } from 'mailparser';
import * as cheerio from 'cheerio';
import { GlobalTixOrder, GlobalTixItem } from '../types';

/* =======================================================
 * UTILITIES
 * ======================================================= */

function normalize(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function extract(text: string, regex: RegExp): string | undefined {
    return text.match(regex)?.[1]?.trim();
}

function parseDate(raw?: string): Date | undefined {
    if (!raw) return undefined;
    const d = new Date(raw.replace(/\s+/g, ' '));
    return isNaN(d.getTime()) ? undefined : d;
}

function parsePrice(raw?: string): number | undefined {
    if (!raw) return undefined;
    const num = Number(raw.replace(/[^\d]/g, ''));
    return Number.isFinite(num) ? num : undefined;
}

/* =======================================================
 * ITEM PARSER (HTML)
 * ======================================================= */

function extractItemsFromHtml(html: string): GlobalTixItem[] {
    const $ = cheerio.load(html);
    const items: GlobalTixItem[] = [];
    const seen = new Set<string>();

    $('table').each((_, table) => {
        const text = normalize($(table).text());

        if (!/confirmation code/i.test(text)) return;

        const confirmationCode =
            extract(text, /Confirmation Code\s*[:\-]?\s*([A-Z0-9]+)/i) ??
            text.match(/\b[A-Z0-9]{6,}\b/)?.[0];

        if (!confirmationCode || seen.has(confirmationCode)) return;

        const sku =
            text.match(/WM-[A-Z0-9\-]+/)?.[0] ?? 'UNKNOWN-SKU';

        const productName =
            extract(text, /(eSIM.+?)(?:WM-|Visit Date|Quantity|IDR|$)/i) ??
            'Unknown Product';

        items.push({
            confirmationCode,
            productName,
            sku,
            visitDate: parseDate(
                extract(text, /Visit Date\s*[:\-]?\s*(.+?)(?:Quantity|IDR|$)/i)
            ),
            quantity:
                Number(extract(text, /Quantity\s*[:\-]?\s*(\d+)/i)) || 1,
            unitPrice: parsePrice(
                extract(text, /IDR\s*([\d.,]+)/i)
            )
        });

        seen.add(confirmationCode);
    });

    return items;
}

/* =======================================================
 * ITEM PARSER (TEXT)
 * ======================================================= */

function extractItemsFromText(text: string): GlobalTixItem[] {
    const items: GlobalTixItem[] = [];
    const seen = new Set<string>();

    const blocks = text.split(/Confirmation Code\s*/i).slice(1);

    for (const block of blocks) {
        const t = normalize(block);

        const confirmationCode =
            t.match(/^([A-Z0-9]{6,})/)?.[1];

        if (!confirmationCode || seen.has(confirmationCode)) continue;

        const sku =
            t.match(/WM-[A-Z0-9\-]+/)?.[0] ?? 'UNKNOWN-SKU';

        items.push({
            confirmationCode,
            productName:
                extract(t, /(eSIM.+?)(?:WM-|Visit Date|Quantity|IDR|$)/i) ??
                'Unknown Product',
            sku,
            visitDate: parseDate(
                extract(t, /Visit Date\s*[:\-]?\s*(.+?)(?:IDR|Quantity|$)/i)
            ),
            quantity:
                Number(extract(t, /Quantity\s*[:\-]?\s*(\d+)/i)) || 1,
            unitPrice: parsePrice(
                extract(t, /IDR\s*([\d.,]+)/i)
            )
        });

        seen.add(confirmationCode);
    }

    return items;
}

/* =======================================================
 * CUSTOMER PARSER (HTML)
 * ======================================================= */

function extractCustomerFromHtml(html: string) {
    const $ = cheerio.load(html);
    const data: any = {};

    $('tr').each((_, row) => {
        const cols = $(row).find('td');
        if (cols.length !== 2) return;

        const label = normalize($(cols[0]).text());
        const value = normalize($(cols[1]).text());

        if (/Reference Number/i.test(label)) data.referenceNumber = value;
        else if (/Purchase Date/i.test(label)) data.purchaseDate = value;
        else if (/Reseller Name/i.test(label)) data.resellerName = value;
        else if (/Customer Name/i.test(label)) data.customerName = value;
        else if (/Customer Email/i.test(label)) data.customerEmail = value.toLowerCase();
        else if (/Alternative Email/i.test(label)) data.alternativeEmail = value.toLowerCase();
        else if (/Mobile Number/i.test(label)) data.mobileNumber = value;
    });

    data.paymentStatus =
        extract($.text(), /Payment Collection Status\s*[:\-]?\s*(\w+)/i);

    return data;
}

/* =======================================================
 * MAIN PARSER (FINAL)
 * ======================================================= */

export function parseGlobalTixEmail(
    parsed: ParsedMail
): GlobalTixOrder | null {

    const text = parsed.text ?? '';
    const html = typeof parsed.html === 'string' ? parsed.html : '';

    if (!text && !html) return null;

    /* 🔒 SAFE FILTER */
    const subject = parsed.subject?.toLowerCase() ?? '';
    const from = parsed.from?.text?.toLowerCase() ?? '';

    if (!from.includes('globaltix')) return null;
    if (!subject.includes('ticket')) return null;

    const htmlCustomer = html ? extractCustomerFromHtml(html) : {};

    const referenceNumber =
        htmlCustomer.referenceNumber ||
        extract(text, /Reference Number\s*[:\-]?\s*([A-Z0-9]+)/i);

    if (!referenceNumber) return null;

    let items = html ? extractItemsFromHtml(html) : [];
    if (!items.length && text) items = extractItemsFromText(text);
    if (!items.length) return null;

    return {
        referenceNumber,
        purchaseDate: parseDate(
            htmlCustomer.purchaseDate ||
            extract(text, /Purchase Date\s*[:\-]?\s*(.+)/i)
        ),
        resellerName:
            htmlCustomer.resellerName ||
            extract(text, /Reseller Name\s*[:\-]?\s*(.+)/i),
        customerName:
            htmlCustomer.customerName ||
            extract(text, /Customer Name\s*[:\-]?\s*(.+)/i) ||
            '',
        customerEmail:
            htmlCustomer.customerEmail ||
            extract(text, /Customer Email\s*[:\-]?\s*(\S+@\S+)/i)?.toLowerCase() ||
            '',
        alternativeEmail:
            htmlCustomer.alternativeEmail ||
            extract(text, /Alternative Email\s*[:\-]?\s*(\S+@\S+)/i),
        mobileNumber:
            htmlCustomer.mobileNumber ||
            extract(text, /Mobile Number\s*[:\-]?\s*(\d+)/i),
        paymentStatus:
            htmlCustomer.paymentStatus ||
            extract(text, /Payment Collection Status\s*[:\-]?\s*(\w+)/i),
        items
    };
}
