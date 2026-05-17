// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.
//
// Heavily inspired by the nanoid library:
// https://github.com/ai/nanoid/tree/main

/**
 * Alphabet of characters that will be considered for string generation.
 */
const kAlphabet = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

/**
 * Generates a URL-safe string of the given `size` using a cryptographically secure random source.
 * 
 * @param size Size, in bytes, of the string to generate. Must be between 1 and 1024, inclusive.
 * @return String of the given `size` with random URL-safe characters.
 */
export function nanoid(size: number): string {
    if (size <= 0 || size > 1024)
        throw new RangeError('size must be in range of [1, 1024]');

    // biome-ignore lint/suspicious/noAssignInExpressions: avoid `valueOf` abusing:
    const bytes = crypto.getRandomValues(new Uint8Array(size |= 0));
    return [ ...bytes ].map(byte => kAlphabet[byte % kAlphabet.length]).join('');
}
