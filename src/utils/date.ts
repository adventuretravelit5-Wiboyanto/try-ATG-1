/* ======================================================
 * DATE UTILITIES
 * ====================================================== */

/**
 * Convert unknown value to Date
 * - Accepts Date | string | null | undefined
 * - Returns null if invalid
 */
export function toDate(
    value?: string | Date | null
): Date | null {
    if (!value) return null;

    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
    }

    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Format date to YYYY-MM-DD
 * - Safe for PDF & logs
 */
export function formatDateISO(
    value?: string | Date | null
): string {
    const date = toDate(value);
    if (!date) return '-';

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    return `${y}-${m}-${d}`;
}

/**
 * Format date to human readable
 * Example: 12 Jan 2026
 */
export function formatDateHuman(
    value?: string | Date | null
): string {
    const date = toDate(value);
    if (!date) return '-';

    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

/**
 * Get current timestamp ISO string
 */
export function nowIso(): string {
    return new Date().toISOString();
}

/**
 * Add days to date
 */
export function addDays(
    value: string | Date,
    days: number
): Date {
    const date = toDate(value);
    if (!date) {
        throw new Error('Invalid date value');
    }

    const result = new Date(date);
    result.setDate(result.getDate() + days);

    return result;
}
