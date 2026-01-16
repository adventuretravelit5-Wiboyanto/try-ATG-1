import fs from 'fs/promises';
import path from 'path';

/* ======================================================
 * FILE SYSTEM UTILITIES
 * ====================================================== */

/**
 * Ensure directory exists
 * - Recursive safe
 * - No error if already exists
 */
export async function ensureDirExists(
    dirPath: string
): Promise<void> {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
        throw new Error(
            `Failed to create directory ${dirPath}: ${error?.message}`
        );
    }
}

/**
 * Check if file exists
 */
export async function fileExists(
    filePath: string
): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Delete file safely (no throw if not exists)
 */
export async function deleteFileIfExists(
    filePath: string
): Promise<void> {
    try {
        await fs.unlink(filePath);
    } catch (error: any) {
        if (error.code !== 'ENOENT') {
            throw new Error(
                `Failed to delete file ${filePath}: ${error.message}`
            );
        }
    }
}

/**
 * Resolve safe file path (prevent traversal)
 */
export function resolveSafePath(
    baseDir: string,
    fileName: string
): string {
    const resolvedPath = path.resolve(baseDir, fileName);

    if (!resolvedPath.startsWith(path.resolve(baseDir))) {
        throw new Error('Invalid file path');
    }

    return resolvedPath;
}
