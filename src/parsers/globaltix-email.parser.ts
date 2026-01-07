import { ParsedMail } from 'mailparser';
import * as cheerio from 'cheerio';
import { GlobalTixOrder, GlobalTixItem } from '../types';

/**
 * Helper extract dari plain text
 */
function extract(text: string, regex: RegExp): string | undefined {
    const match = text.match(regex);
    return match ? match[1].trim() : undefined;
}

/**
 * Normalize price "IDR 1.250.000" → 1250000
 */
function parsePrice(raw?: string): number | undefined {
    if (!raw) return undefined;
    return Number(raw.replace(/[^\d]/g, '')) || undefined;
}

/**
 * Parse tanggal dengan aman
 */
function parseDate(raw?: string): Date | undefined {
    if (!raw) return undefined;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Parse order items dari HTML GlobalTix
 */
function extractItemsFromHtml(html: string): GlobalTixItem[] {
    const $ = cheerio.load(html);
    const items: GlobalTixItem[] = [];

    /**
     * Strategy:
     * - Setiap item SELALU punya Confirmation Code
     * - Kita split berdasarkan text block yang mengandung itu
     */
    $('body')
        .find('*')
        .each((_, el) => {
            const blockText = $(el).text().replace(/\s+/g, ' ').trim();

            if (!blockText.includes('Confirmation Code')) return;

            const confirmationCode =
                blockText.match(/Confirmation Code\s*[:\-]?\s*([A-Z0-9]+)/i)?.[1] ||
                blockText.match(/\b[A-Z0-9]{6,}\b/)?.[0];

            if (!confirmationCode) return;

            const productName =
                blockText.match(/Product\s*Name\s*[:\-]?\s*(.+?)\s*(SKU|Visit|Quantity)/i)?.[1]?.trim()
                || blockText.match(/eSIM.+?(?=SKU|Visit|Quantity)/i)?.[0]?.trim()
                || 'Unknown Product';

            const sku =
                blockText.match(/SKU\s*[:\-]?\s*([A-Z0-9\-]+)/i)?.[1] ||
                blockText.match(/WM-[A-Z0-9\-]+/)?.[0];

            const visitDate =
                parseDate(
                    blockText.match(/Visit Date\s*[:\-]?\s*([\w\s,]+)/i)?.[1]
                );

            const quantity =
                Number(
                    blockText.match(/Quantity\s*[:\-]?\s*(\d+)/i)?.[1]
                ) || 1;

            const unitPrice =
                parsePrice(
                    blockText.match(/IDR\s*([\d.,]+)/i)?.[1]
                );

            // Hindari duplikat confirmation code
            if (items.some(i => i.confirmationCode === confirmationCode)) {
                return;
            }

            items.push({
                confirmationCode,
                productName,
                productVariant: sku,
                sku: sku || 'UNKNOWN-SKU',
                visitDate,
                quantity,
                unitPrice
            });
        });

    return items;
}

/**
 * MAIN PARSER GLOBALTIX
 */
export function parseGlobalTixEmail(
    parsed: ParsedMail
): GlobalTixOrder | null {

    const text = parsed.text || '';
    const html = typeof parsed.html === 'string' ? parsed.html : '';

    if (!text || !html) {
        console.warn('[parser] email missing text/html');
        return null;
    }

    const referenceNumber = extract(
        text,
        /Reference Number\s*[:\-]?\s*([A-Z0-9]+)/i
    );

    if (!referenceNumber) {
        console.warn('[parser] reference number not found');
        return null;
    }

    const purchaseDateRaw = extract(
        text,
        /Purchase Date\s*[:\-]?\s*(.+)/i
    );

    const items = extractItemsFromHtml(html);

    if (!items.length) {
        console.warn(
            `[parser] no items found for order ${referenceNumber}`
        );
        return null;
    }

    console.log(
        `🧾 Parsed ${items.length} item(s) for order ${referenceNumber}`
    );

    return {
        referenceNumber,
        purchaseDate: parseDate(purchaseDateRaw),
        resellerName: extract(text, /Reseller Name\s*[:\-]?\s*(.+)/i),
        customerName: extract(text, /Customer Name\s*[:\-]?\s*(.+)/i) || '',
        customerEmail: extract(text, /Customer Email\s*[:\-]?\s*(.+)/i) || '',
        alternateEmail: extract(text, /Alternate Email\s*[:\-]?\s*(.+)/i),
        mobileNumber: extract(text, /Mobile Number\s*[:\-]?\s*(.+)/i),
        paymentStatus: extract(text, /Payment Collection Status\s*[:\-]?\s*(.+)/i),
        items
    };
}
