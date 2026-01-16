import { pool } from './pool';

/* ======================================================
 * TYPES
 * ====================================================== */

export type SyncStatus = 'SUCCESS' | 'FAILED';

export interface SyncLogCreate {
    confirmationCode: string;
    referenceNumber: string;
    targetService: string;
    requestPayload: unknown;
    responsePayload?: unknown;
    status: SyncStatus;
    errorMessage?: string;
}

export interface SyncLogRow {
    id: string;
    confirmation_code: string;
    reference_number: string;
    target_service: string;
    request_payload: any;
    response_payload: any;
    status: SyncStatus;
    error_message: string | null;
    attempt_count: number;
    created_at: Date;
    updated_at: Date;
}

/* ======================================================
 * REPOSITORY
 * ====================================================== */

export class SyncLogRepository {

    /* ======================================================
     * CHECK SUCCESS (IDEMPOTENCY GUARD)
     * - respects partial unique index (SUCCESS only)
     * ====================================================== */
    async isAlreadySynced(
        confirmationCode: string,
        targetService: string
    ): Promise<boolean> {

        const { rows } = await pool.query<{ exists: boolean }>(
            `
            SELECT EXISTS (
                SELECT 1
                FROM sync_logs
                WHERE confirmation_code = $1
                  AND target_service = $2
                  AND status = 'SUCCESS'
            ) AS exists
            `,
            [confirmationCode, targetService]
        );

        return rows[0]?.exists ?? false;
    }

    /* ======================================================
     * UPSERT LOG
     * RULES:
     * - SUCCESS never overwritten
     * - FAILED increments attempt_count
     * - uses (confirmation_code, target_service)
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
                attempt_count,
                created_at,
                updated_at
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,1,NOW(),NOW()
            )
            ON CONFLICT (confirmation_code, target_service)
            DO UPDATE SET
                response_payload = EXCLUDED.response_payload,
                status           = EXCLUDED.status,
                error_message    = EXCLUDED.error_message,
                attempt_count    = sync_logs.attempt_count + 1,
                updated_at       = NOW()
            WHERE sync_logs.status <> 'SUCCESS'
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
     * GET FAILED LOGS
     * - for retry worker / admin tools
     * ====================================================== */
    async getFailedLogs(
        targetService?: string,
        limit = 50
    ): Promise<SyncLogRow[]> {

        const params: any[] = [];
        let where = `WHERE status = 'FAILED'`;

        if (targetService) {
            params.push(targetService);
            where += ` AND target_service = $${params.length}`;
        }

        params.push(limit);

        const { rows } = await pool.query<SyncLogRow>(
            `
            SELECT *
            FROM sync_logs
            ${where}
            ORDER BY updated_at ASC
            LIMIT $${params.length}
            `,
            params
        );

        return rows;
    }

    /* ======================================================
     * OPTIONAL: GET LAST ATTEMPT
     * - useful for debugging / admin UI
     * ====================================================== */
    async findLatestAttempt(
        confirmationCode: string,
        targetService: string
    ): Promise<SyncLogRow | null> {

        const { rows } = await pool.query<SyncLogRow>(
            `
            SELECT *
            FROM sync_logs
            WHERE confirmation_code = $1
              AND target_service = $2
            ORDER BY updated_at DESC
            LIMIT 1
            `,
            [confirmationCode, targetService]
        );

        return rows[0] ?? null;
    }
}
