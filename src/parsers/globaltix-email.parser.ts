import { ParsedMail } from 'mailparser';
import { GlobalTixOrder, GlobalTixItem } from '../types';

function extract(text: string, regex: RegExp): string | undefined {
    const match = text.match(regex);
    return match ? match[1].trim() : undefined;
}

function extractBlock(
    text: string,
    start: RegExp,
    end: RegExp
): string | undefined {
    const startMatch = text.match(start);
    const endMatch = text.match(end);
    if (!startMatch || !endMatch) return undefined;

    return text
        .substring(startMatch.index! + startMatch[0].length, endMatch.index)
        .trim();
}

function extractItems(text: string): GlobalTixItem[] {
    const items: GlobalTixItem[] = [];
    const blocks = text.split(/Confirmation Code[\s:\n]*/i).slice(1);

    for (const block of blocks) {
        const confirmationCode = 
        extract(block, /\n\s*([A-Z0-9]{6,})\s*\n/) ||
        extract(block, /^([A-Z0-9]{6,})/);

        if (!confirmationCode) continue;

        const sku =
            extract(block, /([A-Z0-9-]{6,})$/m) || '';

        const productName =
            extract(block, /(eSIM.+)/i) ||
            extract(block, /^(.*?)\n/i) ||
            'Unknown Product';

        const productVariant = extract(block, /(Days\s*\(.+?\))/i);

        const visitDateRaw = extract(block, /Visit Date:\s*(.+)/i);
        const visitDate = visitDateRaw
            ? new Date(visitDateRaw)
            : undefined;

        const quantity = parseInt(
            extract(block, /QUANTITY\s*(\d+)/i) || '1',
            10
        );

        const unitPriceRaw = extract(
            block,
            /UNIT PRICE[\s\S]*?IDR\s*([\d.]+)/i
        );
        const unitPrice = unitPriceRaw
            ? parseFloat(unitPriceRaw)
            : undefined;

        items.push({
            confirmationCode,
            productName: productName.trim(),
            productVariant,
            sku,
            visitDate,
            quantity,
            unitPrice
        });
    }

    return items;
}

export function parseGlobalTixEmail(
    parsed: ParsedMail
): GlobalTixOrder | null {
    const text = parsed.text || '';

    const referenceNumber = extract(
        text,
        /Reference Number\s*:\s*([A-Z0-9]+)/i
    );
    if (!referenceNumber) return null;

    const purchaseDateRaw = extract(
        text,
        /Purchase Date\s*(.+)/i
    );

    const order: GlobalTixOrder = {
        referenceNumber,
        purchaseDate: purchaseDateRaw
            ? new Date(purchaseDateRaw)
            : undefined,
        resellerName: extract(text, /Reseller Name\s*(.+)/i),
        customerName:
            extract(text, /Customer Name\s*(.+)/i) || '',
        customerEmail:
            extract(text, /Customer Email\s*(.+)/i) || '',
        alternateEmail: extract(
            text,
            /Alternate Email\s*(.+)/i
        ),
        mobileNumber: extract(
            text,
            /Mobile Number\s*(.+)/i
        ),
        paymentStatus: extract(
            text,
            /Payment Collection Status\s*:\s*(.+)/i
        ),
        items: extractItems(text)
    };

    if (!order.items.length) return null;
    return order;
}
