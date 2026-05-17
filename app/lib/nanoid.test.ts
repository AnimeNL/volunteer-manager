// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { nanoid } from './nanoid';

describe('nanoid', () => {
    it('should generate strings of the requested size', () => {
        expect(nanoid(1)).toHaveLength(1);
        expect(nanoid(16)).toHaveLength(16);
        expect(nanoid(1024)).toHaveLength(1024);
    });

    it('should throw a RangeError for invalid sizes', () => {
        expect(() => nanoid(0)).toThrow(RangeError);
        expect(() => nanoid(-1)).toThrow(RangeError);
        expect(() => nanoid(1025)).toThrow(RangeError);
    });

    it('should only contain characters from the valid alphabet', () => {
        const id = nanoid(1024);
        const validAlphabetRegex = /^[-0-9A-Z_a-z]+$/;
        expect(validAlphabetRegex.test(id)).toBeTruthy();
    });

    it('should generate unique strings', () => {
        const id1 = nanoid(32);
        const id2 = nanoid(32);
        expect(id1).not.toEqual(id2);
    });

    it('should avoid valueOf abuse', () => {
        let calls = 0;
        const maliciousSize = {
            valueOf() {
                calls++;
                // 1. `size <= 0` (returns 16)
                // 2. `size > 1024` (returns 16)
                // 3. `size |= 0` (returns 32)
                return calls <= 2 ? 16 : 32;
            }
        };

        // @ts-expect-error Intentionally passing an object to test valueOf coercion
        expect(nanoid(maliciousSize)).toHaveLength(32);
        expect(calls).toEqual(3);
    });
});
