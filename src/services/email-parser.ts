import { GlobalTixOrder, GlobalTixItem } from '../types';

export class EmailParser {

    parseGlobalTixEmail(emailBody: string): GlobalTixOrder | null {
        try {
            const referenceNumber =
                emailBody.match(/Reference Number\s*:\s*([A-Z0-9]+)/i)?.[1] ?? '';

            const purchaseDateRaw =
                emailBody.match(/Purchase Date\s+(.+?)(?:\(|$)/m)?.[1];

            const purchaseDate = purchaseDateRaw
                ? new Date(purchaseDateRaw)
                : undefined;

            const resellerName =
                emailBody.match(/Reseller Name\s+(.+)/)?.[1]?.trim();

            const customerName =
                emailBody.match(/Customer Name\s+(.+)/)?.[1]?.trim() ?? '';

            const customerEmail =
                emailBody.match(/Customer Email\s+(.+)/)?.[1]?.trim() ?? '';

            const alternateEmail =
                emailBody.match(/Alternate Email\s+(.+)/)?.[1]?.trim();

            const mobileNumber =
                emailBody.match(/Mobile Number\s+(.+)/)?.[1]?.trim();

            const paymentStatus =
                emailBody.match(/Payment Collection Status\s*:\s*(.+)/)?.[1]?.trim();

            const items = this.extractItems(emailBody);

            if (!referenceNumber || !customerName || !customerEmail) {
                console.error('Missing required fields in email');
                return null;
            }

            return {
                referenceNumber,
                purchaseDate,
                resellerName,
                customerName,
                customerEmail,
                alternateEmail,
                mobileNumber,
                paymentStatus,
                items
            };
        } catch (error) {
            console.error('Error parsing email:', error);
            return null;
        }
    }

    private extractItems(emailBody: string): GlobalTixItem[] {
        const items: GlobalTixItem[] = [];

        try {
            const summary =
                emailBody.match(/Summary\s*\n([\s\S]+?)(?=Payment Collection Status|$)/)?.[1];

            if (!summary) return items;

            const confirmationCode =
                emailBody.match(/Confirmation Code\s+([A-Z0-9]+)/)?.[1] ?? '';

            const productMatch = summary.match(/(\d+)\s*\(([^)]+)\)\s*-\s*(.+)/);

            if (!productMatch) return items;

            const quantity = parseInt(productMatch[1], 10);
            const productInfo = productMatch[3].trim();

            const sku =
                productInfo.match(/([A-Z0-9-]+)$/)?.[1] ?? '';

            const productVariant =
                productInfo.replace(sku, '').trim();

            const productName =
                emailBody.match(/Confirmation Code\s+[A-Z0-9]+\s*\n(.+)/)?.[1]?.trim()
                ?? productVariant;

            const unitPriceRaw =
                emailBody.match(/UNIT PRICE\s+IDR\s+([\d.]+)/)?.[1];

            const unitPrice = unitPriceRaw
                ? parseFloat(unitPriceRaw)
                : undefined;

            const visitDateRaw =
                emailBody.match(/Visit Date:\s*(.+)/)?.[1];

            const visitDate = visitDateRaw
                ? new Date(visitDateRaw)
                : undefined;

            items.push({
                confirmationCode,
                productName,
                productVariant,
                sku,
                quantity,
                unitPrice,
                visitDate
            });
        } catch (error) {
            console.error('Error extracting items:', error);
        }

        return items;
    }

    formatOrderSummary(order: GlobalTixOrder): string {
        return `
Order Summary
-------------
Reference: ${order.referenceNumber}
Customer: ${order.customerName}
Email: ${order.customerEmail}
Items: ${order.items.length}
${order.items.map((item, i) => `
 ${i + 1}. ${item.productName}
    SKU: ${item.sku}
    Qty: ${item.quantity}
    Code: ${item.confirmationCode}
`).join('')}
        `.trim();
    }
}
