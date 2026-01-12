import { pool } from './pool';

/* ======================================================
 * TYPES
 * ====================================================== */

export type SyncStatus = 'SUCCESS' | 'FAILED';

export interface SyncLogCreate {
    confirmationCode: string;
    referenceNumber: string;

    targetService: string;

    requestPayload: any;
    responsePayload?: any;

    status: SyncStatus;
    errorMessage?: string;
}

/* ======================================================
 * REPOSITORY
 * ====================================================== */

export class SyncLogRepository {

    /* ======================================================
     * CREATE / UPSERT LOG
     * - idempotent by confirmation_code
     * ====================================================== */
    async upsertLog(data: SyncLogCreate): Promise<void> {
        await pool.query(
            `
            INSERT INTO sync_logs (
                confirmation_code,
                reference_number,
                target_service,
                request_payload,
                response_payload,
                status,
                error_message,
                attempt_count
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,1)
            ON CONFLICT (confirmation_code)
            DO UPDATE SET
                response_payload = EXCLUDED.response_payload,
                status           = EXCLUDED.status,
                error_message    = EXCLUDED.error_message,
                attempt_count    = sync_logs.attempt_count + 1,
                updated_at       = NOW()
            `,
            [
                data.confirmationCode,
                data.referenceNumber,
                data.targetService,
                JSON.stringify(data.requestPayload),
                data.responsePayload
                    ? JSON.stringify(data.responsePayload)
                    : null,
                data.status,
                data.errorMessage ?? null
            ]
        );
    }

    /* ======================================================
     * CHECK SYNC STATUS
     * - used to prevent double send
     * ====================================================== */
    async isAlreadySynced(
        confirmationCode: string
    ): Promise<boolean> {
        const { rows } = await pool.query<{ status: SyncStatus }>(
            `
            SELECT status
            FROM sync_logs
            WHERE confirmation_code = $1
            LIMIT 1
            `,
            [confirmationCode]
        );

        return rows[0]?.status === 'SUCCESS';
    }

    /* ======================================================
     * GET FAILED LOGS (OPTIONAL)
     * - for retry worker / cron
     * ====================================================== */
    async getFailedLogs(limit = 50) {
        const { rows } = await pool.query(
            `
            SELECT *
            FROM sync_logs
            WHERE status = 'FAILED'
            ORDER BY updated_at ASC
            LIMIT $1
            `,
            [limit]
        );

        return rows;
    }
}
