// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { formatEuroPrice, formatTicketProductName, pluralize } from './format';

describe('format', () => {
    describe('formatEuroPrice', () => {
        it('omits decimals for whole euro amounts and pads cents otherwise', () => {
            expect(formatEuroPrice(2000)).toEqual('€20');
            expect(formatEuroPrice(1250)).toEqual('€12.50');
            expect(formatEuroPrice(505)).toEqual('€5.05');
        });
    });

    describe('formatTicketProductName', () => {
        it('strips a prefixed product type and matching activity title', () => {
            const title = 'Kimono Fusion Lab - East Meets West in Your Style';
            expect(formatTicketProductName(
                `Events Ticket: ${title} on Saturday 18:00-19:00`, title))
                .toEqual('Saturday 18:00-19:00');
            expect(formatTicketProductName(
                `Events Ticket: ${title} on Sunday 14:30-15:30`, title))
                .toEqual('Sunday 14:30-15:30');
        });

        it('strips a leading activity title and separator', () => {
            expect(formatTicketProductName('Workshop - Saturday 18:00-19:00', 'Workshop'))
                .toEqual('Saturday 18:00-19:00');
            expect(formatTicketProductName('Workshop: VIP Seat', 'Workshop'))
                .toEqual('VIP Seat');
            expect(formatTicketProductName('Events Ticket: Workshop (Saturday)', 'Workshop'))
                .toEqual('Saturday');
        });

        it('tolerates case, whitespace, and dash differences', () => {
            expect(formatTicketProductName(
                'events ticket: kimono fusion lab – east meets west on Saturday 18:00-19:00',
                'Kimono Fusion Lab - East  Meets West'))
                .toEqual('Saturday 18:00-19:00');
        });

        it('falls back to a leading prefix when nothing follows the title', () => {
            expect(formatTicketProductName('VIP Ticket: Karaoke Contest', 'Karaoke Contest'))
                .toEqual('VIP Ticket');
        });

        it('preserves the original name when the title does not match on token boundaries', () => {
            expect(formatTicketProductName('Party Ticket: Saturday', 'Art'))
                .toEqual('Party Ticket: Saturday');
            expect(formatTicketProductName('Kimono Fusion Lab', 'Kimono Fusion Lab'))
                .toEqual('Kimono Fusion Lab');
            expect(formatTicketProductName('VIP Access Pass', 'Karaoke Contest'))
                .toEqual('VIP Access Pass');
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
