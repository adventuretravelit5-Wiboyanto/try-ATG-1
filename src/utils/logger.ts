/* ======================================================
 * SIMPLE LOGGER (PRODUCTION SAFE)
 * ====================================================== */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function formatMessage(
    level: LogLevel,
    message: string,
    meta?: any
): string {
    const time = new Date().toISOString();

    if (meta) {
        return `[${time}] [${level}] ${message} ${JSON.stringify(meta)}`;
    }

    return `[${time}] [${level}] ${message}`;
}

/* ======================================================
 * LOGGER EXPORT
 * ====================================================== */

export const logger = {
    info(message: string, meta?: any) {
        console.log(formatMessage('INFO', message, meta));
    },

    warn(message: string, meta?: any) {
        console.warn(formatMessage('WARN', message, meta));
    },

    error(message: string, meta?: any) {
        console.error(formatMessage('ERROR', message, meta));
    },

    debug(message: string, meta?: any) {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(formatMessage('DEBUG', message, meta));
        }
    }
};
