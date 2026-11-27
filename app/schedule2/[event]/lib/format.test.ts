// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { formatEuroPrice, pluralize } from './format';

describe('format', () => {
    describe('formatEuroPrice', () => {
        it('omits decimals for whole euro amounts and pads cents otherwise', () => {
            expect(formatEuroPrice(2000)).toEqual('€20');
            expect(formatEuroPrice(1250)).toEqual('€12.50');
            expect(formatEuroPrice(505)).toEqual('€5.05');
        });
    });

    describe('pluralize', () => {
        it('uses singular for count 1 and plural otherwise', () => {
            expect(pluralize(0, 'ticket')).toEqual('0 tickets');
            expect(pluralize(1, 'ticket')).toEqual('1 ticket');
            expect(pluralize(2, 'ticket')).toEqual('2 tickets');
            expect(pluralize(3, 'category', 'categories')).toEqual('3 categories');
        });
    });
});
