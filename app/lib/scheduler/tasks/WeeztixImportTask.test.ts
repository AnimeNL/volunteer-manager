// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { TaskContext } from '../TaskContext';
import { WeeztixImportTask } from './WeeztixImportTask';
import { formatDate } from '@lib/Temporal';
import { useMockConnection } from '@lib/database/Connection';

const mockGetEvent = vi.fn();
const mockGetOrder = vi.fn();
const mockListOrders = vi.fn();
const mockListTicketTypes = vi.fn();

vi.mock('@lib/integrations/weeztix', () => ({
    createWeeztixClient: async () => ({
        getEvent: mockGetEvent,
        getOrder: mockGetOrder,
        listOrders: mockListOrders,
        listTicketTypes: mockListTicketTypes,
    }),
}));

describe('WeeztixImportTask', () => {
    const mockConnection = useMockConnection();

    let task: WeeztixImportTask;

    beforeEach(async () => {
        mockGetEvent.mockReset();
        mockGetOrder.mockReset();
        mockListOrders.mockReset();
        mockListTicketTypes.mockReset();

        const context = TaskContext.forEphemeralTask('WeeztixImportTask', {});
        task = new WeeztixImportTask(context);
        await (task as any).initialise();
    });

    describe('execute', () => {
        it('resets the interval and skips API calls when no active events exist', async () => {
            task.contextForTesting.setIntervalForRepeatingTask(3600 * 1000, /* force= */ true);

            mockConnection.expect('selectManyRows', query => {
                expect(query).toContain('from events');
                expect(query).toContain('event_weeztix_guid is not null');
                return [];
            });

            const result = await task.execute();
            expect(result).toBe(true);

            expect(mockGetEvent).not.toHaveBeenCalled();
            expect(mockListTicketTypes).not.toHaveBeenCalled();
            expect(mockListOrders).not.toHaveBeenCalled();
            expect(task.contextForTesting.intervalMsForTesting).toBe(
                WeeztixImportTask.kIntervalMaximum);
        });

        it('synchronises ticket types for each active event and updates interval', async () => {
            task.contextForTesting.setIntervalForRepeatingTask(
                WeeztixImportTask.kIntervalMaximum, /* force= */ true);

            const soonEndTime = Temporal.Now.zonedDateTimeISO('UTC').add({ days: 7 });
            const laterEndTime = Temporal.Now.zonedDateTimeISO('UTC').add({ days: 90 });

            mockConnection.expect('selectManyRows', () => [
                {
                    slug: '2026',
                    name: 'AnimeCon 2026',
                    endTime: formatDate(soonEndTime.withTimeZone('UTC'), 'YYYY-MM-DD HH:mm:ss'),
                    context: {
                        companyGuid: 'company-guid-1',
                        eventGuid: 'event-guid-2026',
                    },
                },
                {
                    slug: '2027',
                    name: 'AnimeCon 2027',
                    endTime: formatDate(laterEndTime.withTimeZone('UTC'), 'YYYY-MM-DD HH:mm:ss'),
                    context: {
                        companyGuid: undefined,
                        eventGuid: 'event-guid-2027',
                    },
                },
            ]);

            mockListTicketTypes.mockResolvedValue([]);

            const result = await task.execute();
            expect(result).toBe(true);

            expect(mockListTicketTypes).toHaveBeenCalledTimes(2);
            expect(mockListTicketTypes).toHaveBeenNthCalledWith(1, 'event-guid-2026');
            expect(mockListTicketTypes).toHaveBeenNthCalledWith(2, 'event-guid-2027');
            expect(mockListOrders).not.toHaveBeenCalled();

            // Driven by `soonEndTime` (7 days -> 1 hour), not overwritten by `laterEndTime`.
            expect(task.contextForTesting.intervalMsForTesting).toBe(3600 * 1000);
        });
    });

    describe('importProductsAndTickets', () => {
        it('returns false when no tickets are returned by the API', async () => {
            mockListTicketTypes.mockResolvedValueOnce([]);

            const result = await (task as any).importProductsAndTickets('event-guid-1');
            expect(result).toBe(false);
        });

        it('inserts tickets and products, deduplicating shared products', async () => {
            mockListTicketTypes.mockResolvedValueOnce([
                {
                    guid: 'ticket-1',
                    event_id: 'event-guid-1',
                    name: 'Weekend Pass',
                    description: 'Full weekend access',
                    min_price: 4500,
                    available_stock: 500,
                    sold_count: 120,
                    scanned_count: 0,
                    created_at: '2026-08-02T10:00:00+02:00',
                    updated_at: '2026-08-05T14:00:00+02:00',
                    status: 'available',
                    products: [
                        {
                            guid: 'product-shared',
                            event_id: 'event-guid-1',
                            name: 'Weekend Locker',
                            description: 'Large locker',
                            price: 1250,
                            available_stock: 100,
                            sold_count: 25,
                            scanned_count: 0,
                            status: 'available',
                        },
                        {
                            guid: 'product-lanyard',
                            event_id: 'event-guid-1',
                            name: 'Lanyard',
                            description: null,
                            price: 500,
                            available_stock: 300,
                            sold_count: 40,
                            scanned_count: 0,
                            status: 'available',
                        },
                    ],
                },
                {
                    guid: 'ticket-2',
                    event_id: 'event-guid-1',
                    name: 'VIP Pass',
                    description: '',
                    min_price: 9500,
                    available_stock: 50,
                    sold_count: 50,
                    scanned_count: 0,
                    created_at: '2026-08-01T12:00:00Z',
                    updated_at: '2026-08-03T12:00:00Z',
                    status: 'sold_out',
                    products: [
                        {
                            guid: 'product-shared',
                            event_id: 'event-guid-1',
                            name: 'Weekend Locker',
                            description: 'Large locker',
                            price: 1250,
                            available_stock: 100,
                            sold_count: 25,
                            scanned_count: 0,
                            status: 'available',
                        },
                    ],
                },
            ]);

            mockConnection.expect('selectManyRows', (query, params) => {
                expect(query).toContain('from weeztix_ticket_types');
                expect(params).toEqual([ 'event-guid-1' ]);
                return [];
            });

            const insertedByGuid = new Map<string, unknown[]>();

            mockConnection.expect('beginTransaction');
            for (let i = 0; i < 4; ++i) {
                mockConnection.expect('insert', (query, params) => {
                    expect(query).toContain('insert into weeztix_ticket_types');
                    expect(query).toContain('on duplicate key update');
                    insertedByGuid.set(params[0] as string, params);
                    return 1;
                });
            }
            mockConnection.expect('commit');

            const result = await (task as any).importProductsAndTickets('event-guid-1');
            expect(result).toBe(true);

            expect(insertedByGuid.size).toBe(4);

            // Ticket 1: +02:00 converted to UTC ('2026-08-02 08:00:00' and '2026-08-05 12:00:00').
            expect(insertedByGuid.get('ticket-1')?.slice(0, 12)).toEqual([
                'ticket-1',
                'event-guid-1',
                'Ticket',
                'Weekend Pass',
                'Full weekend access',
                4500,
                500,
                120,
                0,
                'available',
                '2026-08-02 08:00:00',
                '2026-08-05 12:00:00',
            ]);

            // Shared product merges min(created) from ticket-2 and max(updated) from ticket-1.
            expect(insertedByGuid.get('product-shared')?.slice(0, 12)).toEqual([
                'product-shared',
                'event-guid-1',
                'Product',
                'Weekend Locker',
                'Large locker',
                1250,
                100,
                25,
                0,
                'available',
                '2026-08-01 12:00:00',
                '2026-08-05 12:00:00',
            ]);

            // Null/empty descriptions are normalised to null (`undefined` omitted vs SQL `null`).
            expect(insertedByGuid.get('product-lanyard')?.[4]).toBeNull();
            expect(insertedByGuid.get('ticket-2')?.[4]).toBeNull();
        });

        it('skips database writes when live entries match stored records', async () => {
            mockListTicketTypes.mockResolvedValueOnce([
                {
                    guid: 'ticket-1',
                    event_id: 'event-guid-1',
                    name: 'Friday Ticket',
                    description: null,
                    min_price: 2500,
                    available_stock: 200,
                    sold_count: 80,
                    scanned_count: 10,
                    created_at: '2026-08-01T10:00:00Z',
                    updated_at: '2026-08-04T15:30:00Z',
                    status: 'available',
                    products: [],
                },
            ]);

            mockConnection.expect('selectManyRows', () => [
                {
                    guid: 'ticket-1',
                    type: 'Ticket',
                    name: 'Friday Ticket',
                    description: undefined,
                    price: 2500,
                    available: 200,
                    sold: 80,
                    scanned: 10,
                    status: 'available',
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-04 15:30:00',
                    deleted: undefined,
                },
            ]);

            const result = await (task as any).importProductsAndTickets('event-guid-1');
            expect(result).toBe(true);
        });

        it('updates modified entries and restores previously soft-deleted entries', async () => {
            mockListTicketTypes.mockResolvedValueOnce([
                {
                    guid: 'ticket-unchanged',
                    event_id: 'event-guid-1',
                    name: 'Friday Ticket',
                    description: 'Day pass',
                    min_price: 2500,
                    available_stock: 200,
                    sold_count: 80,
                    scanned_count: 0,
                    created_at: '2026-08-01T10:00:00Z',
                    updated_at: '2026-08-04T15:30:00Z',
                    status: 'available',
                    products: [
                        {
                            guid: 'product-restored',
                            event_id: 'event-guid-1',
                            name: 'Parking Token',
                            description: null,
                            price: 1000,
                            available_stock: 50,
                            sold_count: 5,
                            scanned_count: 0,
                            status: 'available',
                        },
                    ],
                },
                {
                    guid: 'ticket-modified',
                    event_id: 'event-guid-1',
                    name: 'Saturday Ticket',
                    description: 'Updated description',
                    min_price: 3000,
                    available_stock: 150,
                    sold_count: 150,
                    scanned_count: 0,
                    created_at: '2026-08-01T10:00:00Z',
                    updated_at: '2026-08-06T09:00:00Z',
                    status: 'sold_out',
                    products: [],
                },
            ]);

            mockConnection.expect('selectManyRows', () => [
                {
                    guid: 'ticket-unchanged',
                    type: 'Ticket',
                    name: 'Friday Ticket',
                    description: 'Day pass',
                    price: 2500,
                    available: 200,
                    sold: 80,
                    scanned: 0,
                    status: 'available',
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-04 15:30:00',
                    deleted: undefined,
                },
                {
                    guid: 'product-restored',
                    type: 'Product',
                    name: 'Parking Token',
                    description: undefined,
                    price: 1000,
                    available: 50,
                    sold: 5,
                    scanned: 0,
                    status: 'available',
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-04 15:30:00',
                    deleted: '2026-08-05 00:00:00',
                },
                {
                    guid: 'ticket-modified',
                    type: 'Ticket',
                    name: 'Saturday Ticket',
                    description: 'Old description',
                    price: 3000,
                    available: 150,
                    sold: 140,
                    scanned: 0,
                    status: 'available',
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-05 09:00:00',
                    deleted: undefined,
                },
            ]);

            const upsertedGuids: string[] = [];

            mockConnection.expect('beginTransaction');
            for (let i = 0; i < 2; ++i) {
                mockConnection.expect('insert', (query, params) => {
                    expect(query).toContain('weeztix_ticket_deleted = ?');
                    upsertedGuids.push(params[0] as string);
                    return 1;
                });
            }
            mockConnection.expect('commit');

            const result = await (task as any).importProductsAndTickets('event-guid-1');
            expect(result).toBe(true);
            expect(upsertedGuids).toEqual([ 'product-restored', 'ticket-modified' ]);
        });

        it('soft-deletes active entries omitted from the API response', async () => {
            mockListTicketTypes.mockResolvedValueOnce([
                {
                    guid: 'ticket-active',
                    event_id: 'event-guid-1',
                    name: 'Friday Ticket',
                    description: null,
                    min_price: 2500,
                    available_stock: 200,
                    sold_count: 80,
                    scanned_count: 0,
                    created_at: '2026-08-01T10:00:00Z',
                    updated_at: '2026-08-04T15:30:00Z',
                    status: 'available',
                    products: [],
                },
            ]);

            mockConnection.expect('selectManyRows', () => [
                {
                    guid: 'ticket-active',
                    type: 'Ticket',
                    name: 'Friday Ticket',
                    description: undefined,
                    price: 2500,
                    available: 200,
                    sold: 80,
                    scanned: 0,
                    status: 'available',
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-04 15:30:00',
                    deleted: undefined,
                },
                {
                    guid: 'ticket-removed',
                    type: 'Ticket',
                    name: 'Early Bird',
                    description: undefined,
                    price: 2000,
                    available: 100,
                    sold: 100,
                    scanned: 0,
                    status: 'sold_out',
                    created: '2026-06-01 10:00:00',
                    updated: '2026-07-01 10:00:00',
                    deleted: undefined,
                },
                {
                    guid: 'ticket-already-deleted',
                    type: 'Ticket',
                    name: 'Archived Pass',
                    description: undefined,
                    price: 1500,
                    available: 0,
                    sold: 0,
                    scanned: 0,
                    status: 'not_sold_right_now',
                    created: '2026-05-01 10:00:00',
                    updated: '2026-05-02 10:00:00',
                    deleted: '2026-05-03 10:00:00',
                },
            ]);

            mockConnection.expect('beginTransaction');
            mockConnection.expect('update', (query, params) => {
                expect(query).toContain('update weeztix_ticket_types set weeztix_ticket_deleted =');
                expect(query).toContain('weeztix_ticket_deleted is null');
                expect(params).toEqual([ 'event-guid-1', 'ticket-removed' ]);
                return 1;
            });
            mockConnection.expect('commit');

            const result = await (task as any).importProductsAndTickets('event-guid-1');
            expect(result).toBe(true);
        });
    });

    describe('importOrders', () => {
        it('returns false when no orders are returned by the statistics API', async () => {
            mockListOrders.mockResolvedValueOnce([]);

            const result = await (task as any).importOrders('company-guid-1', 'event-guid-1');
            expect(result).toBe(false);
        });

        it('queries orders filtered by eventGuid with 12h compensation', async () => {
            mockListOrders.mockResolvedValueOnce([
                { guid: 'order-0', updated_at: '2026-08-05T12:00:00+00:00' },
            ]);

            const mostRecentUpdate =
                Temporal.Instant.from('2026-08-05T00:00:00Z').toZonedDateTimeISO('UTC');

            const result = await (task as any).importOrders(
                'company-guid-1', 'event-guid-1', mostRecentUpdate);

            expect(result).toBe(true);
            expect(mockListOrders).toHaveBeenCalledWith('company-guid-1', expect.objectContaining({
                offset: 0,
                limit: 100,
                timeunit: 'year',
                range_applies_to: 'updated_at',
                // 2026-08-05T00:00:00Z minus 12h race condition compensation:
                start: '2026-08-04T12:00:00+00:00',
                sorting: { updated_at: 'desc' },
                events: [ 'event-guid-1' ],
            }));
        });
    });

    describe('updateTaskIntervalForFestivalDate', () => {
        it('should scale the task interval based on duration until the festival', () => {
            task.contextForTesting.setIntervalForRepeatingTask(
                WeeztixImportTask.kIntervalMaximum, /* force= */ true);

            expect(task.contextForTesting.intervalMsForTesting).toBe(
                WeeztixImportTask.kIntervalMaximum);

            const anonymousTask = task as any;

            // 1. Event in the past
            anonymousTask.updateTaskIntervalForFestivalDate(
                Temporal.Now.zonedDateTimeISO('UTC').subtract({ days: 1 }));
            expect(task.contextForTesting.intervalMsForTesting).toBe(
                WeeztixImportTask.kIntervalMaximum);

            // 2. Within 14 days (e.g. 5 days)
            anonymousTask.updateTaskIntervalForFestivalDate(
                Temporal.Now.zonedDateTimeISO('UTC').add({ days: 5 }));
            expect(task.contextForTesting.intervalMsForTesting).toBe(3600 * 1000);

            // 3. Within 28 days (e.g. 20 days)
            anonymousTask.updateTaskIntervalForFestivalDate(
                Temporal.Now.zonedDateTimeISO('UTC').add({ days: 20 }));
            expect(task.contextForTesting.intervalMsForTesting).toBe(3 * 3600 * 1000);

            // 4. Within 56 days (e.g. 45 days)
            anonymousTask.updateTaskIntervalForFestivalDate(
                Temporal.Now.zonedDateTimeISO('UTC').add({ days: 45 }));
            expect(task.contextForTesting.intervalMsForTesting).toBe(6 * 3600 * 1000);

            // 5. Far in the future (e.g. 90 days)
            anonymousTask.updateTaskIntervalForFestivalDate(
                Temporal.Now.zonedDateTimeISO('UTC').add({ days: 90 }));
            expect(task.contextForTesting.intervalMsForTesting).toBe(
                WeeztixImportTask.kIntervalMaximum);
        });
    });
});
