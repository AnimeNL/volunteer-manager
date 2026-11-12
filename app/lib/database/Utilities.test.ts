// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { truncateToByteLength } from './Utilities';

import { kMaxTextColumnByteLength } from './Utilities';

describe('Database Utilities', () => {
    it('truncates strings to a UTF-8 byte limit without splitting multi-byte sequences', () => {
        expect(truncateToByteLength('hello', 10)).toBe('hello');
        expect(truncateToByteLength('hello', 0)).toBe('');
        expect(truncateToByteLength('abcdef', 4)).toBe('abcd');

        // 65,535 UTF-16 code units, but 65,536 UTF-8 bytes ('é' is 2 bytes).
        const twoByteBoundary = 'a'.repeat(kMaxTextColumnByteLength - 1) + 'é';
        expect(twoByteBoundary).toHaveLength(kMaxTextColumnByteLength);
        expect(Buffer.byteLength(twoByteBoundary, 'utf8')).toBe(kMaxTextColumnByteLength + 1);

        const truncatedTwoByte = truncateToByteLength(twoByteBoundary);
        expect(Buffer.byteLength(truncatedTwoByte, 'utf8')).toBe(kMaxTextColumnByteLength - 1);
        expect(truncatedTwoByte).not.toContain('\ufffd');

        // 3-byte CJK characters ('あ' is 3 UTF-8 bytes).
        const cjk = 'あ'.repeat(30000);
        const truncatedCjk = truncateToByteLength(cjk);
        expect(Buffer.byteLength(truncatedCjk, 'utf8')).toBe(65535);
        expect(truncatedCjk).toHaveLength(21845);
        expect(truncatedCjk).not.toContain('\ufffd');

        // 4-byte astral emoji ('🎉' is 2 UTF-16 code units, 4 UTF-8 bytes) crossing the boundary.
        const emojiBoundary = 'a'.repeat(kMaxTextColumnByteLength - 3) + '🎉';
        expect(emojiBoundary).toHaveLength(kMaxTextColumnByteLength - 1);
        expect(Buffer.byteLength(emojiBoundary, 'utf8')).toBe(kMaxTextColumnByteLength + 1);

        const truncatedEmoji = truncateToByteLength(emojiBoundary);
        expect(Buffer.byteLength(truncatedEmoji, 'utf8')).toBe(kMaxTextColumnByteLength - 3);
        expect(truncatedEmoji).not.toContain('\ufffd');
    });
});
