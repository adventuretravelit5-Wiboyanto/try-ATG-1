import { GlobalTixOrder, GlobalTixItem } from '../types';

export class EmailParser {
    /**
     * Parse GlobalTix email and extract order data
     */
    parseGlobalTixEmail(emailBody: string): GlobalTixOrder | null {
        try {
            // Extract reference number
            const refMatch = emailBody.match(/Reference Number\s*:\s*([A-Z0-9]+)/i);
            const referenceNumber = refMatch ? refMatch[1].trim() : '';

            // Extract purchase date
            const dateMatch = emailBody.match(/Purchase Date\s+(.+?)(?:\(|$)/m);
            const purchaseDate = dateMatch ? dateMatch[1].trim() : '';

            // Extract reseller name
            const resellerMatch = emailBody.match(/Reseller Name\s+(.+)/);
            const resellerName = resellerMatch ? resellerMatch[1].trim() : '';

            // Extract customer name
            const nameMatch = emailBody.match(/Customer Name\s+(.+)/);
            const customerName = nameMatch ? nameMatch[1].trim() : '';

            // Extract customer email
            const emailMatch = emailBody.match(/Customer Email\s+(.+)/);
            const customerEmail = emailMatch ? emailMatch[1].trim() : '';

            // Extract alternate email
            const altEmailMatch = emailBody.match(/Alternate Email\s+(.+)/);
            const alternateEmail = altEmailMatch ? altEmailMatch[1].trim() : '';

            // Extract mobile number
            const mobileMatch = emailBody.match(/Mobile Number\s+(.+)/);
            const mobileNumber = mobileMatch ? mobileMatch[1].trim() : '';

            // Extract NRIC/Passport (optional)
            const nricMatch = emailBody.match(/NRIC \/ Passport\s+(.+)/);
            const nric = nricMatch ? nricMatch[1].trim() : '';

            // Extract remarks
            const remarksMatch = emailBody.match(/Remarks\s*\n(.+?)(?=Summary|$)/s);
            const remarks = remarksMatch ? remarksMatch[1].trim() : '';

            // Extract payment status
            const paymentMatch = emailBody.match(/Payment Collection Status\s*:\s*(.+)/);
            const paymentStatus = paymentMatch ? paymentMatch[1].trim() : '';

            // Extract items
            const items = this.extractItems(emailBody);

            // Validate required fields
            if (!referenceNumber || !customerName || !customerEmail) {
                console.error('Missing required fields in email');
                return null;
            }

            const order: GlobalTixOrder = {
                referenceNumber,
                purchaseDate,
                resellerName,
                customerName,
                customerEmail,
                alternateEmail,
                mobileNumber,
                nric: nric || undefined,
                remarks,
                items,
                paymentStatus
            };

            return order;
        } catch (error) {
            console.error('Error parsing email:', error);
            return null;
        }
    }

    /**
     * Extract items from email body
     */
    private extractItems(emailBody: string): GlobalTixItem[] {
        const items: GlobalTixItem[] = [];

        try {
            // Find the Summary section
            const summaryMatch = emailBody.match(/Summary\s*\n([\s\S]+?)(?=Payment Collection Status|$)/);
            if (!summaryMatch) {
                return items;
            }

            const summarySection = summaryMatch[1];

            // Extract confirmation code
            const confirmationMatch = emailBody.match(/Confirmation Code\s+([A-Z0-9]+)/);
            const confirmationCode = confirmationMatch ? confirmationMatch[1].trim() : '';

            // Extract product info - looking for pattern like "1 (Per Item) - 15 Days (10GB) WM-AUNZ-15-10GB"
            const productMatch = summarySection.match(/(\d+)\s*\(([^)]+)\)\s*-\s*(.+)/);

            if (productMatch) {
                const quantity = parseInt(productMatch[1]);
                const quantityType = productMatch[2]; // "Per Item"
                const productInfo = productMatch[3].trim();

                // Extract SKU (last part after space)
                const skuMatch = productInfo.match(/([A-Z0-9-]+)$/);
                const sku = skuMatch ? skuMatch[1] : '';

                // Product name and variant (everything before SKU)
                const nameAndVariant = productInfo.replace(sku, '').trim();

                // Extract product name (line after confirmation code)
                const productNameMatch = emailBody.match(/Confirmation Code\s+[A-Z0-9]+\s*\n(.+)/);
                const productName = productNameMatch ? productNameMatch[1].trim() : nameAndVariant;

                // Extract variant (the part with days and data)
                const variantMatch = productInfo.match(/^(.+?)\s+[A-Z0-9-]+$/);
                const variant = variantMatch ? variantMatch[1].trim() : nameAndVariant;

                // Extract unit price
                const priceMatch = emailBody.match(/UNIT PRICE\s+IDR\s+([\d.]+)/);
                const unitPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;

                // Extract date/time
                const dateTimeMatch = emailBody.match(/Date\/Time:\s*(.+)/);
                const dateTime = dateTimeMatch ? dateTimeMatch[1].trim() : '';

                // Extract visit date
                const visitDateMatch = emailBody.match(/Visit Date:\s*(.+)/);
                const visitDate = visitDateMatch ? visitDateMatch[1].trim() : '';

                items.push({
                    confirmationCode,
                    productName,
                    variant,
                    sku,
                    quantity,
                    unitPrice,
                    dateTime,
                    visitDate
                });
            }
        } catch (error) {
            console.error('Error extracting items:', error);
        }

        return items;
    }

    /**
     * Format order data for logging/debugging
     */
    formatOrderSummary(order: GlobalTixOrder): string {
        return `
Order Summary:
--------------
Reference: ${order.referenceNumber}
Customer: ${order.customerName}
Email: ${order.customerEmail}
Mobile: ${order.mobileNumber}
Items: ${order.items.length}
${order.items.map((item, idx) => `
  ${idx + 1}. ${item.productName}
     SKU: ${item.sku}
     Qty: ${item.quantity}
     Code: ${item.confirmationCode}
`).join('')}
    `.trim();
    }
}
