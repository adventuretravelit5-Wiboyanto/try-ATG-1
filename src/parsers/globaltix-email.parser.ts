import { ParsedMail } from 'mailparser';
import * as cheerio from 'cheerio';
import { GlobalTixOrder, GlobalTixItem } from '../types';

/* ==================== HELPERS ==================== */

function extract(text: string, regex: RegExp): string | undefined {
    const match = text.match(regex);
    return match?.[1]?.trim();
}

function normalize(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function parsePrice(raw?: string): number | undefined {
    if (!raw) return undefined;
    const n = Number(raw.replace(/[^\d]/g, ''));
    return Number.isFinite(n) ? n : undefined;
}

function parseDate(raw?: string): Date | undefined {
    if (!raw) return undefined;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? undefined : d;
}

/* ==================== HTML ITEM PARSER (PRIMARY) ==================== */

function extractItemsFromHtml(html: string): GlobalTixItem[] {
    const $ = cheerio.load(html);
    const items: GlobalTixItem[] = [];
    const seen = new Set<string>();

    $('body *').each((_, el) => {
        const text = normalize($(el).text());
        if (!/confirmation code/i.test(text)) return;

        const confirmationCode =
            text.match(/Confirmation Code\s*[:\-]?\s*([A-Z0-9]{6,})/i)?.[1] ??
            text.match(/\b[A-Z0-9]{6,}\b/)?.[0];

        if (!confirmationCode || seen.has(confirmationCode)) return;

        const sku =
            text.match(/WM-[A-Z0-9\-]+/)?.[0] ??
            text.match(/SKU\s*[:\-]?\s*([A-Z0-9\-]+)/i)?.[1] ??
            'UNKNOWN-SKU';

        const productName =
            text.match(/eSIM.+?(?=WM-|SKU|Visit|Quantity|IDR)/i)?.[0]?.trim() ??
            text.match(/Product\s*Name\s*[:\-]?\s*(.+?)(?=SKU|Visit|Quantity|IDR)/i)?.[1]?.trim() ??
            'Unknown Product';

        const visitDate = parseDate(
            text.match(/Visit Date\s*[:\-]?\s*([\w\s,]+)/i)?.[1]
        );

        const quantity =
            Number(text.match(/Quantity\s*[:\-]?\s*(\d+)/i)?.[1]) || 1;

        const unitPrice = parsePrice(
            text.match(/IDR\s*([\d.,]+)/i)?.[1]
        );

        items.push({
            confirmationCode,
            productName,
            productVariant: sku,
            sku,
            visitDate,
            quantity,
            unitPrice
        });

        seen.add(confirmationCode);
    });

    return items;
}

/* ==================== TEXT ITEM PARSER (FALLBACK) ==================== */

function extractItemsFromText(text: string): GlobalTixItem[] {
    const items: GlobalTixItem[] = [];
    const seen = new Set<string>();

    const blocks = text.split(/Confirmation Code\s*[:\-]?\s*/i).slice(1);

    for (const block of blocks) {
        const normalized = normalize(block);

        const confirmationCode =
            normalized.match(/^([A-Z0-9]{6,})/)?.[1] ??
            normalized.match(/\b[A-Z0-9]{6,}\b/)?.[0];

        if (!confirmationCode || seen.has(confirmationCode)) continue;

        const sku =
            normalized.match(/WM-[A-Z0-9\-]+/)?.[0] ??
            normalized.match(/SKU\s*[:\-]?\s*([A-Z0-9\-]+)/i)?.[1] ??
            'UNKNOWN-SKU';

        const productName =
            normalized.match(/eSIM.+?(?=WM-|SKU|Visit|Quantity|IDR)/i)?.[0]?.trim() ??
            'Unknown Product';

        items.push({
            confirmationCode,
            productName,
            productVariant: sku,
            sku,
            visitDate: parseDate(
                normalized.match(/Visit Date\s*[:\-]?\s*(.+?)(IDR|Quantity|$)/i)?.[1]
            ),
            quantity:
                Number(normalized.match(/Quantity\s*[:\-]?\s*(\d+)/i)?.[1]) || 1,
            unitPrice: parsePrice(
                normalized.match(/IDR\s*([\d.,]+)/i)?.[1]
            )
        });

        seen.add(confirmationCode);
    }

    return items;
}

/* ==================== MAIN PARSER (FINAL) ==================== */

export function parseGlobalTixEmail(
    parsed: ParsedMail
): GlobalTixOrder | null {

    const text = parsed.text ?? '';
    const html = typeof parsed.html === 'string' ? parsed.html : '';

    if (!text && !html) {
        console.warn('[parser] empty email body');
        return null;
    }

    // 🧠 VALIDASI AWAL (ANTI SALAH EMAIL)
    const subject = parsed.subject?.toLowerCase() ?? '';
    if (!subject.includes('ticket')) {
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

    // 🔥 HTML FIRST
    let items = html ? extractItemsFromHtml(html) : [];

    // 🔄 TEXT FALLBACK
    if (!items.length && text) {
        items = extractItemsFromText(text);
    }

    if (!items.length) {
        console.warn(`[parser] no items found for ${referenceNumber}`);
        return null;
    }

    console.log(
        `🧾 Parsed ${items.length} item(s) for order ${referenceNumber}`
    );

    return {
        referenceNumber,
        purchaseDate: parseDate(
            extract(text, /Purchase Date\s*[:\-]?\s*(.+)/i)
        ),
        resellerName: extract(text, /Reseller Name\s*[:\-]?\s*(.+)/i),
        customerName: extract(text, /Customer Name\s*[:\-]?\s*(.+)/i) ?? '',
        customerEmail:
            extract(text, /Customer Email\s*[:\-]?\s*(.+)/i)?.toLowerCase() ?? '',
        alternateEmail: extract(text, /Alternate Email\s*[:\-]?\s*(.+)/i),
        mobileNumber: extract(text, /Mobile Number\s*[:\-]?\s*(.+)/i),
        paymentStatus: extract(
            text,
            /Payment Collection Status\s*[:\-]?\s*(.+)/i
        ),
        items
    };
}
