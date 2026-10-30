// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Formats a number of bytes into a human-readable string.
 */
export function formatBytes(bytes: number): string {
    if (bytes <= 0)
        return '0 bytes';

    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    const sizes = [ 'bytes', 'KB', 'MB', 'GB', 'TB' ];
    const size = parseFloat((bytes / k ** i).toFixed(1));
    return `${size} ${sizes[i]}`;
}
