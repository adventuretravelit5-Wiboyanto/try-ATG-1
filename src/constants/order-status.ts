/* ======================================================
 * ORDER & ESIM STATUS CONSTANTS
 * ====================================================== */

/* ======================================================
 * ORDER STATUS (orders table)
 * ====================================================== */

export const ORDER_STATUS = {
    RECEIVED: 'RECEIVED',        // email parsed & stored
    SENT_TO_THIRD_PARTY: 'SENT', // order sent successfully
    FAILED: 'FAILED',            // fatal error (manual intervention)
    COMPLETED: 'COMPLETED'       // all items done
} as const;

export type OrderStatus =
    typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

/* ======================================================
 * ESIM STATUS (esim_details table)
 * ====================================================== */

export const ESIM_STATUS = {
    PENDING: 'PENDING',          // waiting for provisioning
    PROCESS: 'PROCESS',          // provisioning in progress
    READY: 'READY',              // esim active, ready for PDF
    PDF_GENERATED: 'PDF',        // pdf generated locally
    DONE: 'DONE',                // pdf delivered to GlobalTix
    FAILED: 'FAILED'             // provisioning/pdf failed
} as const;

export type EsimStatus =
    typeof ESIM_STATUS[keyof typeof ESIM_STATUS];

/* ======================================================
 * SYNC STATUS (sync_logs table)
 * ====================================================== */

export const SYNC_STATUS = {
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED'
} as const;

export type SyncStatus =
    typeof SYNC_STATUS[keyof typeof SYNC_STATUS];

/* ======================================================
 * GUARDS & HELPERS
 * ====================================================== */

/**
 * Check if eSIM is eligible for PDF generation
 */
export function canGeneratePdf(
    status: EsimStatus
): boolean {
    return status === ESIM_STATUS.READY;
}

/**
 * Check if eSIM is fully completed
 */
export function isEsimDone(
    status: EsimStatus
): boolean {
    return status === ESIM_STATUS.DONE;
}

/**
 * Check if order is terminal
 */
export function isFinalOrderStatus(
    status: OrderStatus
): boolean {
    return (
        status === ORDER_STATUS.COMPLETED ||
        status === ORDER_STATUS.FAILED
    );
}
