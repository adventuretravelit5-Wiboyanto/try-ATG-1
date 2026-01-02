# Gmail Worker untuk GlobalTix Automation

Worker service untuk memonitor email dari GlobalTix, extract data customer dan order, issue eSIM, dan mengirim email otomatis ke customer.

## 🚀 Features

- ✅ Monitor Gmail inbox via IMAP
- ✅ Auto-detect email dari GlobalTix
- ✅ Extract data customer dan order details
- ✅ Issue eSIM ke sistem internal (placeholder)
- ✅ Kirim email konfirmasi ke customer
- ✅ Professional HTML email templates

## 📋 Prerequisites

- Node.js 18+ dan npm
- Gmail account dengan App Password enabled
- SMTP access (Gmail atau email provider lain)

## 🔧 Setup

### 1. Install Dependencies

```bash
cd gmail-worker
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` ke `.env`:

```bash
cp .env.example .env
```

Edit `.env` dan isi dengan credentials Anda:

```env
# IMAP Configuration (Gmail)
IMAP_USER=globalkomunika.cs@gmail.com
IMAP_PASSWORD=your_app_password_here
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_TLS=true

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=globalkomunika.cs@gmail.com
SMTP_PASSWORD=your_app_password_here
SMTP_FROM_NAME=Global Komunika
SMTP_FROM_EMAIL=globalkomunika.cs@gmail.com
```

### 3. Gmail App Password

Untuk menggunakan Gmail dengan IMAP/SMTP, Anda perlu membuat App Password:

1. Buka [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification jika belum
3. Buka "App passwords"
4. Generate password baru untuk "Mail"
5. Copy password dan paste ke `.env` file

## 🎯 Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
# Build TypeScript
npm run build

# Run compiled code
npm start
```

## 📁 Project Structure

```
gmail-worker/
├── src/
│   ├── config/
│   │   └── index.ts          # Configuration loader
│   ├── services/
│   │   ├── imap-service.ts   # IMAP email monitoring
│   │   ├── email-parser.ts   # Email parsing & extraction
│   │   ├── smtp-service.ts   # Email sending
│   │   └── esim-service.ts   # eSIM integration (placeholder)
│   ├── templates/
│   │   └── customer-email.html  # Email template
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces
│   └── index.ts              # Main application
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🔄 Workflow

1. **Monitor Inbox**: Worker connects ke Gmail via IMAP dan monitor untuk email baru
2. **Filter Email**: Hanya process email dari `ticket@globaltix.com` dengan subject "New Purchased Tickets"
3. **Parse Data**: Extract semua data penting:
   - Reference Number
   - Customer Name, Email, Mobile
   - Alternate Email
   - Items (Product, SKU, Quantity, Confirmation Code)
4. **Issue eSIM**: Call sistem internal untuk issue eSIM (currently mock)
5. **Send Email**: Kirim email konfirmasi ke customer dengan order details
6. **Mark as Read**: Mark email sebagai read di inbox

## 📧 Email Template

Email yang dikirim ke customer menggunakan professional HTML template dengan:
- Gradient header
- Order details table
- eSIM activation codes (jika tersedia)
- Responsive design

## 🔌 eSIM Integration

Worker ini menggunakan **provider abstraction pattern** untuk eSIM service, memudahkan switching antara provider atau testing dengan mock data.

### Provider Options

#### 1. Mock Provider (Default)
- **Tidak perlu API key**
- Generate dummy eSIM codes untuk testing
- Format: `MOCK-ESIM-{SKU}-{RANDOM}-{INDEX}`
- Cocok untuk development dan testing flow

#### 2. Real Provider (Optional)
Provider gratis yang bisa diintegrasikan:
- **Airalo** - Sandbox mode gratis
- **Dataplans.io** - Free sandbox API
- **eSIM.sm** - Testing dengan sandbox header
- **eSIMFree.org** - Free 5GB untuk developer

### Configuration

Tambahkan ke `.env` file:

```env
# eSIM Provider Configuration
ESIM_PROVIDER=mock                    # Options: mock, airalo, dataplans, esim-sm, esimfree
# ESIM_API_KEY=your_api_key_here      # Required for real providers
# ESIM_API_URL=https://api.provider.com  # Optional, provider-specific
# ESIM_SANDBOX=true                   # Enable sandbox mode for testing
```

### Implementation

Service sudah implement provider abstraction di `src/services/esim-service.ts`:

```typescript
// Provider interface
export interface IEsimProvider {
    issueEsim(request: EsimIssueRequest): Promise<EsimIssueResponse>;
    validateSku(sku: string): Promise<boolean>;
}

// Service automatically selects provider based on config
const esimService = new EsimService(esimConfig);
```

### Adding New Provider

Untuk menambahkan provider baru:

1. Create provider class yang implement `IEsimProvider`
2. Add provider ke factory di `EsimService` constructor
3. Update type `EsimProviderConfig` di `src/types/index.ts`

Contoh:

```typescript
export class AiraloProvider implements IEsimProvider {
    async issueEsim(request: EsimIssueRequest): Promise<EsimIssueResponse> {
        const response = await fetch('https://api.airalo.com/v1/esim', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        });
        return await response.json();
    }
    
    async validateSku(sku: string): Promise<boolean> {
        // Implementation
    }
}
```

## 🐛 Troubleshooting

### IMAP Connection Failed

- Pastikan App Password sudah benar
- Check firewall/antivirus tidak block port 993
- Verify 2-Step Verification enabled di Google Account

### SMTP Send Failed

- Verify SMTP credentials
- Check port 587 tidak di-block
- Pastikan "Less secure app access" disabled (gunakan App Password)

### Email Not Detected

- Check email filter di `.env` (FROM dan SUBJECT)
- Verify email masuk ke INBOX, bukan folder lain
- Check logs untuk error messages

## 📝 Development Notes

### Adding New Features

1. **Custom Email Templates**: Edit `src/templates/customer-email.html`
2. **Additional Data Extraction**: Modify `src/services/email-parser.ts`
3. **eSIM API Integration**: Implement `src/services/esim-service.ts`

### Testing

Send test email dengan format GlobalTix ke inbox untuk testing. Worker akan auto-detect dan process email tersebut.

## 🔐 Security

- **Never commit `.env` file** - sudah ada di `.gitignore`
- Use App Passwords, bukan actual Gmail password
- Rotate credentials secara berkala
- Limit IMAP/SMTP access hanya dari trusted IPs jika memungkinkan

## 📄 License

ISC

## 👥 Support

Untuk pertanyaan atau issues, contact development team.
