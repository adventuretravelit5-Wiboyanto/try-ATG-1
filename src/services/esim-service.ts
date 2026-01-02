import { EsimIssueRequest, EsimIssueResponse, EsimProviderConfig } from '../types';

/**
 * Base interface for eSIM providers
 */
export interface IEsimProvider {
    issueEsim(request: EsimIssueRequest): Promise<EsimIssueResponse>;
    validateSku(sku: string): Promise<boolean>;
}

/**
 * Mock eSIM Provider for testing
 * Generates dummy eSIM codes without requiring actual API
 */
export class MockEsimProvider implements IEsimProvider {
    /**
     * Issue mock eSIM codes
     */
    async issueEsim(request: EsimIssueRequest): Promise<EsimIssueResponse> {
        console.log('\n🔄 Issuing eSIM (Mock Provider)...');
        console.log(`  SKU: ${request.sku}`);
        console.log(`  Quantity: ${request.quantity}`);
        console.log(`  Customer: ${request.customerName}`);
        console.log(`  Reference: ${request.referenceNumber}`);

        // Simulate API delay
        await this.delay(800);

        // Generate mock eSIM codes
        const mockCodes = Array.from(
            { length: request.quantity },
            (_, i) => `MOCK-ESIM-${request.sku}-${this.generateRandomCode()}-${i + 1}`
        );

        // Generate QR code URLs (using free QR code API)
        const mockQrCodes = mockCodes.map(
            code => `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(code)}&size=200x200`
        );

        console.log('✓ eSIM issued successfully (MOCK)');
        mockCodes.forEach((code, idx) => {
            console.log(`  Code ${idx + 1}: ${code}`);
        });

        return {
            success: true,
            esimCodes: mockCodes,
            qrCodes: mockQrCodes
        };
    }

    /**
     * Validate SKU (mock always returns true)
     */
    async validateSku(sku: string): Promise<boolean> {
        console.log(`✓ Validating SKU: ${sku} (Mock - always valid)`);
        return true;
    }

    /**
     * Generate random code for mock eSIM
     */
    private generateRandomCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * Helper: Delay function for mock
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Main eSIM Service with provider abstraction
 */
export class EsimService {
    private provider: IEsimProvider;

    constructor(config: EsimProviderConfig) {
        console.log(`\n🔧 Initializing eSIM Service with provider: ${config.provider}`);

        // Provider factory
        switch (config.provider) {
            case 'mock':
                this.provider = new MockEsimProvider();
                break;

            // Future providers can be added here:
            // case 'airalo':
            //     this.provider = new AiraloProvider(config);
            //     break;
            // case 'dataplans':
            //     this.provider = new DataplansProvider(config);
            //     break;

            default:
                console.warn(`⚠️  Unknown provider: ${config.provider}, falling back to mock`);
                this.provider = new MockEsimProvider();
        }
    }

    /**
     * Issue eSIM using configured provider
     */
    async issueEsim(request: EsimIssueRequest): Promise<EsimIssueResponse> {
        try {
            return await this.provider.issueEsim(request);
        } catch (error) {
            console.error('✗ Error issuing eSIM:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * Validate SKU using configured provider
     */
    async validateSku(sku: string): Promise<boolean> {
        try {
            return await this.provider.validateSku(sku);
        } catch (error) {
            console.error('✗ Error validating SKU:', error);
            return false;
        }
    }
}
