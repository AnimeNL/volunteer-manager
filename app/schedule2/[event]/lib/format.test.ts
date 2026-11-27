// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { formatEuroPrice } from './format';

describe('format', () => {
    describe('formatEuroPrice', () => {
        it('omits decimals for whole euro amounts and pads cents otherwise', () => {
            expect(formatEuroPrice(2000)).toEqual('€20');
            expect(formatEuroPrice(1250)).toEqual('€12.50');
            expect(formatEuroPrice(505)).toEqual('€5.05');
        });
    });
});
