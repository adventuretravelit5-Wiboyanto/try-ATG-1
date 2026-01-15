import { pool } from './pool';

/* ======================================================
 * TYPES
 * ====================================================== */

export type EsimStatus =
    | 'PENDING'
    | 'PROCESS'
    | 'COMPLETED'
    | 'DONE'
    | 'FAILED';

export type InsertEsimProvisioningParams = {
    orderItemId: string;
    productName: string;

    validFrom?: string;
    validUntil?: string;

    iccid: string;
    qrCode: string;
    smdpAddress: string;
    activationCode: string;
    combinedActivation: string;

    apnName?: string;
    apnUsername?: string;
    apnPassword?: string;

    status?: EsimStatus;
};

/* ======================================================
 * REPOSITORY
 * ====================================================== */

export class EsimRepository {

    /* ======================================================
     * INSERT
     * ====================================================== */

    /**
     * Insert provisioning result (idempotent by ICCID)
     */
    async insertProvisioning(
        params: InsertEsimProvisioningParams
    ): Promise<void> {

        const sql = `
            INSERT INTO esim_details (
                order_item_id,
                product_name,
                valid_from,
                valid_until,
                iccid,
                qr_code,
                smdp_address,
                activation_code,
                combined_activation,
                apn_name,
                apn_username,
                apn_password,
                status,
                provisioned_at
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW()
            )
            ON CONFLICT (iccid) DO NOTHING
        `;

        await pool.query(sql, [
            params.orderItemId,
            params.productName,
            params.validFrom ?? null,
            params.validUntil ?? null,
            params.iccid,
            params.qrCode,
            params.smdpAddress,
            params.activationCode,
            params.combinedActivation,
            params.apnName ?? null,
            params.apnUsername ?? null,
            params.apnPassword ?? null,
            params.status ?? 'PROCESS'
        ]);
    }

    /* ======================================================
     * FIND
     * ====================================================== */

    async findById(
        esimId: string
    ) {
        const sql = `
            SELECT
                e.*,
                o.reference_number
            FROM esim_details e
            JOIN order_items oi ON oi.id = e.order_item_id
            JOIN orders o ON o.id = oi.order_id
            WHERE e.id = $1
        `;

        const { rows } = await pool.query(sql, [esimId]);
        return rows[0] ?? null;
    }

    async findByOrderItemId(
        orderItemId: string
    ) {
        const sql = `
            SELECT *
            FROM esim_details
            WHERE order_item_id = $1
        `;

        const { rows } = await pool.query(sql, [orderItemId]);
        return rows[0] ?? null;
    }

    /**
     * eSIM ready for PDF generation
     */
    async findPendingCompletion() {
        const sql = `
            SELECT *
            FROM esim_details
            WHERE status = 'PROCESS'
            ORDER BY created_at
        `;

        const { rows } = await pool.query(sql);
        return rows;
    }

    /**
     * PDF generated, waiting external confirmation
     */
    async findCompletedButNotDone() {
        const sql = `
            SELECT *
            FROM esim_details
            WHERE status = 'COMPLETED'
            ORDER BY updated_at
        `;

        const { rows } = await pool.query(sql);
        return rows;
    }

    /* ======================================================
     * STATUS TRANSITIONS
     * ====================================================== */

    async markProcess(
        esimId: string
    ): Promise<void> {

        await this.updateStatus(esimId, 'PROCESS');
    }

    async markCompleted(
        esimId: string
    ): Promise<void> {

        const sql = `
            UPDATE esim_details
            SET status = 'COMPLETED',
                updated_at = NOW()
            WHERE id = $1
        `;

        await pool.query(sql, [esimId]);
    }

    async markDone(
        esimId: string
    ): Promise<void> {

        const sql = `
            UPDATE esim_details
            SET status = 'DONE',
                activated_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
        `;

        await pool.query(sql, [esimId]);
    }

    async markFailed(
        esimId: string,
        reason?: string
    ): Promise<void> {

        const sql = `
            UPDATE esim_details
            SET status = 'FAILED',
                updated_at = NOW()
            WHERE id = $1
        `;

        await pool.query(sql, [esimId]);
    }

    private async updateStatus(
        esimId: string,
        status: EsimStatus
    ): Promise<void> {

        const sql = `
            UPDATE esim_details
            SET status = $2,
                updated_at = NOW()
            WHERE id = $1
        `;

        await pool.query(sql, [esimId, status]);
    }
}
