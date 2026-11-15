// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { computeWeeztixTicketCapacity } from '@lib/integrations/weeztix';
import { fetchFinancialData } from './FinancialData';
import { formatDate } from '@lib/Temporal';
import { useMockConnection } from '@lib/database/Connection';

describe('FinancialData', () => {
    const mockConnection = useMockConnection();

    it('returns undefined when the event is unknown or has no ticketing provider', async () => {
        mockConnection.expect('selectOneRow', (_query, params) => {
            expect(params).toEqual([ 'unknown-slug' ]);
            return undefined;
        });

        expect(await fetchFinancialData('unknown-slug')).toBeUndefined();

        mockConnection.expect('selectOneRow', () => ({
            id: 10,
            slug: '2027',
            shortName: 'AnimeCon 2027',
            startTime: '2027-06-11 12:00:00',
            endTime: '2027-06-13 17:00:00',
            provider: undefined,
            weeztixGuid: 'weeztix-guid-2027',
            ytpEventId: undefined,
        }));

        expect(await fetchFinancialData('2027')).toBeUndefined();
    });

    it('returns undefined when the configured provider has no settled sales yet', async () => {
        // YourTicketProvider with zero sales:
        mockConnection.expect('selectOneRow', () => ({
            id: 10,
            slug: '2026',
            shortName: 'AnimeCon 2026',
            startTime: '2026-06-12 12:00:00',
            endTime: '2026-06-14 17:00:00',
            provider: 'YourTicketProvider',
            weeztixGuid: undefined,
            ytpEventId: 9001,
        }));
        mockConnection.expect('selectOneColumnOneRow', (query, params) => {
            expect(query).toContain('from your_ticket_provider_purchases');
            expect(params).toEqual([ 9001 ]);
            return 0;
        });

        expect(await fetchFinancialData('2026')).toBeUndefined();

        // Weeztix with zero ticket sales and zero purchase sales:
        mockConnection.expect('selectOneRow', () => ({
            id: 11,
            slug: '2027',
            shortName: 'AnimeCon 2027',
            startTime: '2027-06-11 12:00:00',
            endTime: '2027-06-13 17:00:00',
            provider: 'Weeztix',
            weeztixGuid: 'event-guid-2027',
            ytpEventId: undefined,
        }));
        mockConnection.expect('selectOneColumnOneRow', (query, params) => {
            expect(query).toContain('from weeztix_tickets');
            expect(params).toEqual([ 'event-guid-2027', 'paid', 'swapped' ]);
            return 0;
        });
        mockConnection.expect('selectOneColumnOneRow', (query, params) => {
            expect(query).toContain('from weeztix_purchases');
            expect(params).toEqual([ 'event-guid-2027', 'paid', 'swapped' ]);
            return 0;
        });

        expect(await fetchFinancialData('2027')).toBeUndefined();
    });

    it('defers to Weeztix and YourTicketProvider across current and historic events', async () => {
        const futureEndTime = Temporal.Now.zonedDateTimeISO('UTC').add({ days: 30 });
        const futureStartTime = futureEndTime.subtract({ days: 2 });
        const futureEndDate = futureEndTime.toPlainDate();

        // Target event (2027) uses Weeztix even if a legacy ytpEventId is still populated:
        mockConnection.expect('selectOneRow', () => ({
            id: 27,
            slug: '2027',
            shortName: 'AnimeCon 2027',
            startTime: formatDate(futureStartTime, 'YYYY-MM-DD HH:mm:ss'),
            endTime: formatDate(futureEndTime, 'YYYY-MM-DD HH:mm:ss'),
            provider: 'Weeztix',
            weeztixGuid: 'weeztix-2027',
            ytpEventId: 9999,
        }));

        // Target event has settled Weeztix ticket sales:
        mockConnection.expect('selectOneColumnOneRow', () => 12);

        // Historic event (2026) uses YourTicketProvider:
        mockConnection.expect('selectManyRows', query => {
            expect(query).toContain('from events');
            expect(query).toContain('inner join events_tickets_configuration');
            return [
                {
                    id: 26,
                    slug: '2026',
                    shortName: 'AnimeCon 2026',
                    startTime: '2026-06-12 12:00:00',
                    endTime: '2026-06-14 17:00:00',
                    provider: 'YourTicketProvider',
                    weeztixGuid: undefined,
                    ytpEventId: 5026,
                },
            ];
        });

        // 2027 Weeztix configured products (one Ticket, one Product):
        mockConnection.expect('selectManyRows', (query, params) => {
            expect(query).toContain('inner join weeztix_ticket_types');
            expect(params).toEqual([ 100, 'weeztix-2027', 27 ]);
            return [
                {
                    id: 101,
                    typeGuid: 'guid-weekend-ticket',
                    type: 'Ticket',
                    category: 'TicketWeekend',
                    available: 380,
                    sold: 120,
                    status: 'available',
                    price: 65,
                    product: 'Weekend Pass',
                    program: undefined,
                },
                {
                    id: 102,
                    typeGuid: 'guid-locker-weekend',
                    type: 'Product',
                    category: 'LockerWeekend',
                    available: 0,
                    sold: 0,
                    status: 'available',
                    price: 15,
                    product: 'Weekend Locker',
                    program: { id: 88, title: 'Wardrobe' },
                },
            ];
        });

        // 2027 Weeztix ticket daily sales:
        mockConnection.expect('selectManyRows', (query, params) => {
            expect(query).toContain('from weeztix_tickets');
            expect(params).toEqual(
                [ 0, 'weeztix-2027', 'guid-weekend-ticket', 'paid', 'swapped', 0 ]);
            return [
                {
                    typeGuid: 'guid-weekend-ticket',
                    date: futureEndDate.subtract({ days: 400 }).toString(),  // clamps to 365
                    complimentary: false,
                    count: 3,
                },
                {
                    typeGuid: 'guid-weekend-ticket',
                    date: futureEndDate.subtract({ days: 10 }).toString(),
                    complimentary: false,
                    count: 5,
                },
                {
                    typeGuid: 'guid-weekend-ticket',
                    date: futureEndDate.subtract({ days: 10 }).toString(),
                    complimentary: true,
                    count: 2,
                },
            ];
        });

        // 2027 Weeztix product purchase daily sales:
        mockConnection.expect('selectManyRows', (query, params) => {
            expect(query).toContain('from weeztix_purchases');
            expect(query).toContain('left join weeztix_tickets');
            expect(params).toEqual(
                [ 0, 'weeztix-2027', 'guid-locker-weekend', 'paid', 'swapped', 0 ]);
            return [
                {
                    typeGuid: 'guid-locker-weekend',
                    date: futureEndDate.add({ days: 2 }).toString(),  // clamps to 0
                    complimentary: false,
                    count: 4,
                },
            ];
        });

        // 2026 YourTicketProvider configured products:
        mockConnection.expect('selectManyRows', (query, params) => {
            expect(query).toContain('inner join your_ticket_provider_tickets');
            expect(params).toEqual([ 100, 5026, 26 ]);
            return [
                {
                    id: 55,
                    ytpTicketId: 777,
                    category: 'TicketWeekend',
                    limit: 1000,
                    price: 60,
                    product: '2026 Weekend Ticket',
                    program: undefined,
                },
            ];
        });

        // 2026 YourTicketProvider daily sales:
        mockConnection.expect('selectManyRows', (query, params) => {
            expect(query).toContain('from your_ticket_provider_purchases');
            expect(params).toEqual([ 1, 5026, 777, 1 ]);
            return [
                {
                    ytpTicketId: 777,
                    date: '2026-06-04',  // 10 days before 2026-06-14
                    complimentary: false,
                    count: 20,
                },
                {
                    ytpTicketId: 777,
                    date: '2026-06-04',
                    complimentary: true,
                    count: 5,
                },
            ];
        });

        const result = await fetchFinancialData('2027');
        expect(result).toBeDefined();
        expect(result!.provider).toBe('Weeztix');
        expect(result!.providerEventId).toBe('weeztix-2027');
        expect(result!.remaining).toBeGreaterThanOrEqual(29);
        expect(result!.remaining).toBeLessThanOrEqual(30);
        expect(result!.data).toHaveLength(2);

        const [ currentEvent, historicEvent ] = result!.data;
        expect(currentEvent.slug).toBe('2027');
        expect(currentEvent.products.size).toBe(2);

        const weekendPass = currentEvent.products.get(101)!;
        expect(weekendPass.limit).toBe(500);
        expect(weekendPass.paidSales).toBe(8);
        expect(weekendPass.complimentarySales).toBe(2);
        expect(weekendPass.totalSales).toBe(10);
        expect(weekendPass.totalRevenue).toBe(8 * 65);
        expect(weekendPass.sales.get(365)).toEqual({ paid: 3, complimentary: 0 });
        expect(weekendPass.sales.get(10)).toEqual({ paid: 5, complimentary: 2 });

        const weekendLocker = currentEvent.products.get(102)!;
        expect(weekendLocker.limit).toBeUndefined();
        expect(weekendLocker.program).toEqual({ id: 88, title: 'Wardrobe' });
        expect(weekendLocker.paidSales).toBe(4);
        expect(weekendLocker.totalRevenue).toBe(4 * 15);
        expect(weekendLocker.sales.get(0)).toEqual({ paid: 4, complimentary: 0 });

        expect(historicEvent.slug).toBe('2026');
        const historicTicket = historicEvent.products.get(55)!;
        expect(historicTicket.limit).toBe(1000);
        expect(historicTicket.paidSales).toBe(20);
        expect(historicTicket.complimentarySales).toBe(5);
        expect(historicTicket.totalSales).toBe(25);
        expect(historicTicket.totalRevenue).toBe(20 * 60);
        expect(historicTicket.sales.get(10)).toEqual({ paid: 20, complimentary: 5 });
    });

    it('treats Weeztix available=0 as unlimited unless status is sold_out', () => {
        expect(computeWeeztixTicketCapacity(380, 120, 'available')).toBe(500);
        expect(computeWeeztixTicketCapacity(0, 4, 'available')).toBeUndefined();
        expect(computeWeeztixTicketCapacity(0, 4, 'not_sold_right_now')).toBeUndefined();
        expect(computeWeeztixTicketCapacity(0, 4, 'auto')).toBeUndefined();
        expect(computeWeeztixTicketCapacity(0, 4, 'sold_out')).toBe(4);
        expect(computeWeeztixTicketCapacity(0, 0, 'sold_out')).toBeUndefined();
    });
});
