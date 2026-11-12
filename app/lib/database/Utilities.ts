// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Maximum byte length of a MariaDB `TEXT` column (`2^16 - 1` bytes).
 */
export const kMaxTextColumnByteLength = 65535;

/**
 * Truncates `value` so its UTF-8 byte representation does not exceed `maxBytes`, without splitting
 * multi-byte UTF-8 sequences or UTF-16 surrogate pairs.
 */
export function truncateToByteLength(
    value: string, maxBytes: number = kMaxTextColumnByteLength): string
{
    if (maxBytes <= 0)
        return '';

    if (value.length * 3 <= maxBytes)
        return value;

    if (value.length <= maxBytes && Buffer.byteLength(value, 'utf8') <= maxBytes)
        return value;

    const slice = value.length > maxBytes + 1 ? value.slice(0, maxBytes + 1) : value;
    const buffer = Buffer.from(slice, 'utf8');

    let end = maxBytes;
    while (end > 0 && (buffer[end] & 0xc0) === 0x80)
        end--;

    return buffer.subarray(0, end).toString('utf8');
}
