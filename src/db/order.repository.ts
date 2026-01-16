import { pool } from './pool';

/* ======================================================
 * TYPES
 * ====================================================== */

export type OrderStatus =
    | 'RECEIVED'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED';

export type OrderRow = {
    id: string;
    reference_number: string;
    status: OrderStatus;
    created_at: Date;
    updated_at: Date;
};

/* ======================================================
 * REPOSITORY
 * ====================================================== */

export class OrderRepository {

    /* ======================================================
     * FIND
     * ====================================================== */

    /**
     * Find order by reference number
     */
    async findByReferenceNumber(
        referenceNumber: string
    ): Promise<OrderRow | null> {

        const sql = `
            SELECT
                id,
                reference_number,
                status,
                created_at,
                updated_at
            FROM orders
            WHERE reference_number = $1
            LIMIT 1
        `;

        const { rows } = await pool.query(sql, [referenceNumber]);
        return rows[0] ?? null;
    }

    /**
     * Get orders by status
     * - used for retry / cron jobs
     */
    async findByStatus(
        status: OrderStatus,
        limit = 50
    ): Promise<OrderRow[]> {

        const sql = `
            SELECT
                id,
                reference_number,
                status,
                created_at,
                updated_at
            FROM orders
            WHERE status = $1
            ORDER BY updated_at ASC
            LIMIT $2
        `;

        const { rows } = await pool.query(sql, [status, limit]);
        return rows;
    }

    /* ======================================================
     * STATUS TRANSITIONS
     * ====================================================== */

    /**
     * RECEIVED → PROCESSING
     */
    async markProcessing(
        referenceNumber: string
    ): Promise<void> {

        await this.updateStatus(referenceNumber, 'PROCESSING');
    }

    /**
     * PROCESSING → COMPLETED
     */
    async markCompleted(
        referenceNumber: string
    ): Promise<void> {

        await this.updateStatus(referenceNumber, 'COMPLETED');
    }

    /**
     * Any → FAILED
     */
    async markFailed(
        referenceNumber: string
    ): Promise<void> {

        await this.updateStatus(referenceNumber, 'FAILED');
    }

    /* ======================================================
     * INTERNAL
     * ====================================================== */

    private async updateStatus(
        referenceNumber: string,
        status: OrderStatus
    ): Promise<void> {

        const sql = `
            UPDATE orders
            SET status = $2,
                updated_at = NOW()
            WHERE reference_number = $1
        `;

        await pool.query(sql, [referenceNumber, status]);
    }
}
