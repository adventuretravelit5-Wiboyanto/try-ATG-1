import { SmtpService } from '../services/smtp-service';
import { smtpConfig } from '../config';

const smtpService = new SmtpService(smtpConfig);

const DUMMY_TEXT = `
New Purchased Tickets

Reference Number: ZRPQG8VEGT
Confirmation Code: GTMSRLOW
Product: eSIM Australia New Zealand
SKU: WM-AUNZ-15-10GB
Quantity: 1
Price: 1776500
`;

const DUMMY_HTML = `
<html>
  <body>
    <h2>New Purchased Tickets</h2>
    <p><b>Reference Number:</b> ZRPQG8VEGT</p>
    <p><b>Confirmation Code:</b> GTMSRLOW</p>
    <p><b>Product:</b> eSIM Australia New Zealand</p>
    <p><b>SKU:</b> WM-AUNZ-15-10GB</p>
    <p><b>Quantity:</b> 1</p>
    <p><b>Price:</b> 1,776,500</p>
  </body>
</html>
`;

async function sendDummyEmail() {
    await smtpService.verify();

    await smtpService.sendRawMail({
        from: 'gkomunika.gtix@gmail.com',
        to: 'adventuretravel.it5@gmail.com',
        subject: 'New Purchased Tickets',
        text: DUMMY_TEXT,
        html: DUMMY_HTML
    });

    console.log('✅ Dummy email sent');
}

sendDummyEmail().catch(console.error);
