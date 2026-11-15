// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Order } from '@lib/integrations/weeztix/WeeztixTypes';
import { TaskContext } from '../TaskContext';
import { WeeztixImportTask } from './WeeztixImportTask';
import { formatDate } from '@lib/Temporal';
import { useMockConnection } from '@lib/database/Connection';

const mockListOrders = vi.fn();
const mockListTicketTypes = vi.fn();
const { mockRevalidateForEvent } = vi.hoisted(() => ({
    mockRevalidateForEvent: vi.fn(),
}));

vi.mock('@app/admin/events/[event]/finance/FinanceProcessor', () => ({
    FinanceProcessor: {
        revalidateForEvent: mockRevalidateForEvent,
    },
}));

vi.mock('@lib/integrations/weeztix', () => ({
    createWeeztixClient: async () => ({
        listOrders: mockListOrders,
        listTicketTypes: mockListTicketTypes,
    }),
}));

type OrderProduct = Order['products'][number];
type OrderTicket = Order['tickets'][number];

function buildProduct(overrides: Partial<OrderProduct> = {}): OrderProduct {
    return {
        guid: 'product-1',
        product_id: 'type-product-1',
        origin_type: 'product',
        finn_inner_value: 1000,
        finn_service_fee: 50,
        finn_price: 1050,
        invalidated_since: null,
        created_at: '2026-08-01T10:00:00Z',
        updated_at: '2026-08-02T12:00:00Z',
        meta_data: [],
        ...overrides,
    };
}

function buildTicket(overrides: Partial<OrderTicket> = {}): OrderTicket {
    return {
        guid: 'ticket-1',
        ticket_id: 'type-ticket-1',
        ticket_number: 'BARCODE-001',
        finn_value: 4500,
        finn_inner_value: 0,
        finn_service_fee: 250,
        finn_price: 4750,
        invalidated_since: null,
        created_at: '2026-08-01T10:00:00Z',
        updated_at: '2026-08-02T12:00:00Z',
        meta_data: [],
        products: [],
        ...overrides,
    };
}

function buildOrder(overrides: Partial<Order> = {}): Order {
    return {
        guid: 'order-1',
        fullname: 'Jane Doe',
        status: 'paid',
        invalidated_since: null,
        created_at: '2026-08-01T10:00:00Z',
        updated_at: '2026-08-02T12:00:00Z',
        products: [],
        tickets: [],
        ...overrides,
    };
}

describe('WeeztixImportTask', () => {
    const mockConnection = useMockConnection();

    let task: WeeztixImportTask;

    beforeEach(async () => {
        mockListOrders.mockReset();
        mockListTicketTypes.mockReset();
        mockRevalidateForEvent.mockReset();

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
                expect(query).toContain(
                    'select max(weeztix_order_updated) as result from weeztix_orders');
                return [];
            });

            const result = await task.execute();
            expect(result).toBe(true);

            expect(mockListTicketTypes).not.toHaveBeenCalled();
            expect(mockListOrders).not.toHaveBeenCalled();
            expect(mockRevalidateForEvent).not.toHaveBeenCalled();
            expect(task.contextForTesting.intervalMsForTesting).toBe(
                WeeztixImportTask.kIntervalMaximum);
        });

        it('synchronises active events, scales interval, and validates context', async () => {
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
                        companyGuid: undefined,
                        eventGuid: 'event-guid-2026',
                    },
                    mostRecentUpdate: undefined,
                },
            ]);

            await expect(task.execute()).rejects.toThrow('without a company GUID');

            mockConnection.expect('selectManyRows', () => [
                {
                    slug: '2026',
                    name: 'AnimeCon 2026',
                    endTime: formatDate(soonEndTime.withTimeZone('UTC'), 'YYYY-MM-DD HH:mm:ss'),
                    context: {
                        companyGuid: 'company-guid-1',
                        eventGuid: 'event-guid-2026',
                    },
                    mostRecentUpdate: '2026-08-05 00:00:00',
                },
                {
                    slug: '2027',
                    name: 'AnimeCon 2027',
                    endTime: formatDate(laterEndTime.withTimeZone('UTC'), 'YYYY-MM-DD HH:mm:ss'),
                    context: {
                        companyGuid: 'company-guid-2',
                        eventGuid: 'event-guid-2027',
                    },
                    mostRecentUpdate: undefined,
                },
            ]);

            mockListTicketTypes.mockResolvedValue([]);
            mockListOrders.mockResolvedValue([]);

            const result = await task.execute();
            expect(result).toBe(true);

            expect(mockListTicketTypes).toHaveBeenNthCalledWith(1, 'event-guid-2026');
            expect(mockListTicketTypes).toHaveBeenNthCalledWith(2, 'event-guid-2027');

            expect(mockListOrders).toHaveBeenNthCalledWith(
                1, 'company-guid-1', expect.objectContaining({
                    start: '2026-08-04T12:00:00+00:00',
                    sorting: { updated_at: 'asc' },
                    events: [ 'event-guid-2026' ],
                }));
            expect(mockListOrders).toHaveBeenNthCalledWith(
                2, 'company-guid-2', expect.objectContaining({
                    sorting: { updated_at: 'asc' },
                    events: [ 'event-guid-2027' ],
                }));

            // Driven by `soonEndTime` (7 days -> 1 hour), not overwritten by `laterEndTime`.
            expect(task.contextForTesting.intervalMsForTesting).toBe(3600 * 1000);

            expect(mockRevalidateForEvent).toHaveBeenNthCalledWith(1, '2026');
            expect(mockRevalidateForEvent).toHaveBeenNthCalledWith(2, '2027');
        });
    });

    describe('importProductsAndTickets', () => {
        it('avoids database writes when empty or when stored entries match', async () => {
            mockListTicketTypes.mockResolvedValueOnce([]);
            expect(await (task as any).importProductsAndTickets('event-guid-1')).toBe(false);

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

            expect(await (task as any).importProductsAndTickets('event-guid-1')).toBe(true);
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
                            guid: 'product-ticket-origin',
                            event_id: 'event-guid-1',
                            origin_type: 'ticket',
                            name: 'Weekend Pass',
                            description: null,
                            price: 4500,
                            available_stock: 500,
                            sold_count: 120,
                            scanned_count: 0,
                            status: 'available',
                        },
                        {
                            guid: 'product-shared',
                            event_id: 'event-guid-1',
                            origin_type: 'product',
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
                            origin_type: 'product',
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
                            origin_type: 'product',
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
            expect(insertedByGuid.has('product-ticket-origin')).toBe(false);

            expect(insertedByGuid.get('ticket-1')?.slice(0, 13)).toEqual([
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
                null,
            ]);

            // Shared product merges min(created) from ticket-2 and max(updated) from ticket-1.
            expect(insertedByGuid.get('product-shared')?.slice(0, 13)).toEqual([
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
                null,
            ]);

            expect(insertedByGuid.get('product-lanyard')?.[4]).toBeNull();
            expect(insertedByGuid.get('ticket-2')?.[4]).toBeNull();
        });

        it('updates modified, restores deleted, and soft-deletes omitted entries', async () => {
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
                            origin_type: 'product',
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

            const upsertedGuids: string[] = [];

            mockConnection.expect('beginTransaction');
            for (let i = 0; i < 2; ++i) {
                mockConnection.expect('insert', (query, params) => {
                    expect(query).toContain('weeztix_ticket_deleted = ?');
                    expect(params[12]).toBeNull();
                    upsertedGuids.push(params[0] as string);
                    return 1;
                });
            }
            mockConnection.expect('update', (query, params) => {
                expect(query).toContain('update weeztix_ticket_types set weeztix_ticket_deleted =');
                expect(query).toContain('weeztix_ticket_deleted is null');
                expect(params).toEqual([ 'event-guid-1', 'ticket-removed' ]);
                return 1;
            });
            mockConnection.expect('commit');

            const result = await (task as any).importProductsAndTickets('event-guid-1');
            expect(result).toBe(true);
            expect(upsertedGuids).toEqual([ 'product-restored', 'ticket-modified' ]);
        });
    });

    describe('importOrders', () => {
        it('paginates with 12h compensation, deduplicates orders, and skips empty', async () => {
            mockListOrders.mockResolvedValueOnce([]);
            expect(await (task as any).importOrders('company-guid-1', 'event-guid-1')).toBe(false);

            vi.useFakeTimers({ toFake: [ 'setTimeout' ] });
            try {
                const firstPage = Array.from({ length: 100 }, (_, index) =>
                    buildOrder({ guid: `order-${index}`, status: 'pending' }));
                const secondPage = [ buildOrder({ guid: 'order-0', status: 'paid' }) ];

                mockListOrders
                    .mockResolvedValueOnce(firstPage)
                    .mockResolvedValueOnce(secondPage);

                mockConnection.expect('selectManyRows', () =>
                    Array.from({ length: 99 }, (_, index) => ({
                        guid: `order-${index + 1}`,
                        eventGuid: 'event-guid-1',
                        name: 'Jane Doe',
                        status: 'pending',
                        created: '2026-08-01 10:00:00',
                        updated: '2026-08-02 12:00:00',
                        deleted: undefined,
                    })));
                mockConnection.expect('selectManyRows', () => []);
                mockConnection.expect('selectManyRows', () => []);

                let insertedOrderParams: unknown[] = [];
                mockConnection.expect('beginTransaction');
                mockConnection.expect('insert', (_query, params) => {
                    insertedOrderParams = params;
                    return 1;
                });
                mockConnection.expect('commit');

                const mostRecentUpdate =
                    Temporal.Instant.from('2026-08-05T00:00:00Z').toZonedDateTimeISO('UTC');

                const resultPromise = (task as any).importOrders(
                    'company-guid-1', 'event-guid-1', mostRecentUpdate);
                await vi.runAllTimersAsync();
                expect(await resultPromise).toBe(true);

                expect(mockListOrders).toHaveBeenNthCalledWith(
                    2, 'company-guid-1', expect.objectContaining({
                        offset: 0,
                        limit: 100,
                        timeunit: 'year',
                        range_applies_to: 'updated_at',
                        start: '2026-08-04T12:00:00+00:00',
                        sorting: { updated_at: 'asc' },
                        events: [ 'event-guid-1' ],
                    }));
                expect(mockListOrders).toHaveBeenNthCalledWith(
                    3, 'company-guid-1', expect.objectContaining({
                        offset: 100,
                        limit: 100,
                        sorting: { updated_at: 'asc' },
                    }));

                // Duplicate `order-0` across pages retains the status from the later page.
                expect(insertedOrderParams.slice(0, 4)).toEqual([
                    'order-0',
                    'event-guid-1',
                    'Jane Doe',
                    'paid',
                ]);
            } finally {
                vi.useRealTimers();
            }
        });

        it('imports orders, tickets, and ticket- and order-associated purchases', async () => {
            const sharedAddonProduct = buildProduct({
                guid: 'purchase-ticket-addon',
                product_id: 'type-locker',
                origin_type: 'product',
                finn_price: 1250,
                finn_service_fee: 50,
                meta_data: [],
            });

            mockListOrders.mockResolvedValueOnce([
                buildOrder({
                    guid: 'order-1',
                    fullname: '  Jane   Doe  ',
                    status: 'paid',
                    created_at: '2026-08-02T10:00:00+02:00',
                    updated_at: '2026-08-05T14:00:00+02:00',
                    tickets: [
                        buildTicket({
                            guid: 'ticket-1',
                            ticket_id: 'type-weekend',
                            ticket_number: 'BARCODE-777',
                            finn_price: 5250,
                            finn_service_fee: 250,
                            created_at: '2026-08-02T10:00:00+02:00',
                            updated_at: '2026-08-05T14:00:00+02:00',
                            meta_data: [
                                { value: 'John', meta_data: { name: 'first_name' } },
                                { value: 'Smith', meta_data: { name: 'last_name' } },
                                {
                                    value: '  Johnny   S  ',
                                    meta_data: { name: '  nickname (for badge) ' },
                                },
                            ],
                            products: [
                                buildProduct({
                                    guid: 'purchase-ticket-origin',
                                    product_id: 'type-weekend-product',
                                    origin_type: 'ticket',
                                    finn_price: 4200,
                                    finn_service_fee: 200,
                                    meta_data: [
                                        { value: 'Jane', meta_data: { name: 'first_name' } },
                                        { value: 'Doe', meta_data: { name: 'last_name' } },
                                        { value: true, meta_data: { name: 'terms' } },
                                    ],
                                }),
                                sharedAddonProduct,
                            ],
                        }),
                    ],
                    products: [
                        sharedAddonProduct,
                        buildProduct({
                            guid: 'purchase-order-merch',
                            product_id: 'type-tshirt',
                            origin_type: 'product',
                            finn_price: 2650,
                            finn_service_fee: 150,
                            meta_data: [
                                { value: 'Jane', meta_data: { name: 'first_name' } },
                            ],
                        }),
                    ],
                }),
                buildOrder({
                    guid: 'order-2',
                    fullname: '   ',
                    status: 'cancelled',
                    invalidated_since: '2026-08-06T10:00:00Z',
                }),
            ]);

            mockConnection.expect('selectManyRows', query => {
                expect(query).toContain('from weeztix_orders');
                return [];
            });
            mockConnection.expect('selectManyRows', query => {
                expect(query).toContain('from weeztix_tickets');
                return [];
            });
            mockConnection.expect('selectManyRows', query => {
                expect(query).toContain('from weeztix_purchases');
                expect(query).not.toContain('weeztix_ticket_guid is not null');
                return [];
            });

            const ordersByGuid = new Map<string, unknown[]>();
            const ticketsByGuid = new Map<string, unknown[]>();
            const purchasesByGuid = new Map<string, unknown[]>();

            mockConnection.expect('beginTransaction');
            for (let i = 0; i < 2; ++i) {
                mockConnection.expect('insert', (query, params) => {
                    expect(query).toContain('insert into weeztix_orders');
                    ordersByGuid.set(params[0] as string, params);
                    return 1;
                });
            }
            mockConnection.expect('insert', (query, params) => {
                expect(query).toContain('insert into weeztix_tickets');
                ticketsByGuid.set(params[0] as string, params);
                return 1;
            });
            for (let i = 0; i < 3; ++i) {
                mockConnection.expect('insert', (query, params) => {
                    expect(query).toContain('insert into weeztix_purchases');
                    purchasesByGuid.set(params[0] as string, params);
                    return 1;
                });
            }
            mockConnection.expect('commit');

            expect(await (task as any).importOrders('company-guid-1', 'event-guid-1')).toBe(true);

            expect(ordersByGuid.get('order-1')?.slice(0, 7)).toEqual([
                'order-1',
                'event-guid-1',
                'Jane Doe',
                'paid',
                '2026-08-02 08:00:00',
                '2026-08-05 12:00:00',
                null,
            ]);
            expect(ordersByGuid.get('order-2')?.slice(0, 7)).toEqual([
                'order-2',
                'event-guid-1',
                null,
                'cancelled',
                '2026-08-01 10:00:00',
                '2026-08-02 12:00:00',
                '2026-08-06 10:00:00',
            ]);

            expect(ticketsByGuid.get('ticket-1')?.slice(0, 11)).toEqual([
                'ticket-1',
                'order-1',
                'event-guid-1',
                'type-weekend',
                'BARCODE-777',
                'John Smith',
                'Johnny S',
                5000,
                '2026-08-02 08:00:00',
                '2026-08-05 12:00:00',
                null,
            ]);

            expect(purchasesByGuid.get('purchase-ticket-origin')?.slice(0, 10)).toEqual([
                'purchase-ticket-origin',
                'ticket-1',
                'order-1',
                'event-guid-1',
                'type-weekend-product',
                'Jane Doe',
                4000,
                '2026-08-01 10:00:00',
                '2026-08-02 12:00:00',
                null,
            ]);
            expect(purchasesByGuid.get('purchase-ticket-addon')?.slice(0, 7)).toEqual([
                'purchase-ticket-addon',
                'ticket-1',
                'order-1',
                'event-guid-1',
                'type-locker',
                null,
                1200,
            ]);
            expect(purchasesByGuid.get('purchase-order-merch')?.slice(0, 10)).toEqual([
                'purchase-order-merch',
                null,
                'order-1',
                'event-guid-1',
                'type-tshirt',
                'Jane',
                2500,
                '2026-08-01 10:00:00',
                '2026-08-02 12:00:00',
                null,
            ]);
        });

        it('skips database writes when live orders, tickets, and purchases match', async () => {
            mockListOrders.mockResolvedValueOnce([
                buildOrder({
                    guid: 'order-1',
                    fullname: '',
                    status: 'paid',
                    tickets: [
                        buildTicket({
                            guid: 'ticket-1',
                            invalidated_since: '2026-08-06T10:00:00Z',
                            products: [
                                buildProduct({
                                    guid: 'purchase-ticket',
                                    meta_data: [
                                        { value: 'Jane', meta_data: { name: 'first_name' } },
                                        { value: 'Doe', meta_data: { name: 'last_name' } },
                                    ],
                                }),
                            ],
                        }),
                    ],
                    products: [
                        buildProduct({ guid: 'purchase-order' }),
                    ],
                }),
            ]);

            mockConnection.expect('selectManyRows', () => [
                {
                    guid: 'order-1',
                    eventGuid: 'event-guid-1',
                    name: undefined,
                    status: 'paid',
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-02 12:00:00',
                    deleted: undefined,
                },
            ]);
            mockConnection.expect('selectManyRows', () => [
                {
                    guid: 'ticket-1',
                    orderGuid: 'order-1',
                    eventGuid: 'event-guid-1',
                    typeGuid: 'type-ticket-1',
                    barcode: 'BARCODE-001',
                    name: undefined,
                    nickname: undefined,
                    price: 4500,
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-02 12:00:00',
                    deleted: '2026-08-06 10:00:00',
                },
            ]);
            mockConnection.expect('selectManyRows', () => [
                {
                    guid: 'purchase-ticket',
                    ticketGuid: 'ticket-1',
                    orderGuid: 'order-1',
                    eventGuid: 'event-guid-1',
                    typeGuid: 'type-product-1',
                    name: 'Jane Doe',
                    price: 1000,
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-02 12:00:00',
                    deleted: undefined,
                },
                {
                    guid: 'purchase-order',
                    ticketGuid: undefined,
                    orderGuid: 'order-1',
                    eventGuid: 'event-guid-1',
                    typeGuid: 'type-product-1',
                    name: undefined,
                    price: 1000,
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-02 12:00:00',
                    deleted: undefined,
                },
            ]);

            expect(await (task as any).importOrders('company-guid-1', 'event-guid-1')).toBe(true);
        });

        it('updates modified records, maps invalidations, and soft-deletes omitted', async () => {
            mockListOrders.mockResolvedValueOnce([
                buildOrder({
                    guid: 'order-1',
                    status: 'cancelled',
                    invalidated_since: '2026-08-07T12:00:00Z',
                    updated_at: '2026-08-07T12:00:00Z',
                    tickets: [
                        buildTicket({
                            guid: 'ticket-unchanged',
                            meta_data: [
                                { value: 'Jane', meta_data: { name: 'first_name' } },
                                { value: 'Janie', meta_data: { name: 'NICKNAME' } },
                            ],
                            products: [
                                buildProduct({ guid: 'purchase-unchanged' }),
                            ],
                        }),
                        buildTicket({
                            guid: 'ticket-invalidated',
                            invalidated_since: '2026-08-07T12:00:00Z',
                            updated_at: '2026-08-07T12:00:00Z',
                            meta_data: [
                                { value: 'Alex', meta_data: { name: 'first_name' } },
                                { value: 'Lee', meta_data: { name: 'last_name' } },
                            ],
                        }),
                    ],
                    products: [
                        buildProduct({
                            guid: 'purchase-modified',
                            finn_price: 2050,
                            finn_service_fee: 50,
                            invalidated_since: '2026-08-07T12:00:00Z',
                            updated_at: '2026-08-07T12:00:00Z',
                        }),
                    ],
                }),
            ]);

            mockConnection.expect('selectManyRows', () => [
                {
                    guid: 'order-1',
                    eventGuid: 'event-guid-1',
                    name: 'Jane Doe',
                    status: 'paid',
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-02 12:00:00',
                    deleted: undefined,
                },
            ]);
            mockConnection.expect('selectManyRows', () => [
                {
                    guid: 'ticket-unchanged',
                    orderGuid: 'order-1',
                    eventGuid: 'event-guid-1',
                    typeGuid: 'type-ticket-1',
                    barcode: 'BARCODE-001',
                    name: 'Jane',
                    nickname: 'Janie',
                    price: 4500,
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-02 12:00:00',
                    deleted: undefined,
                },
                {
                    guid: 'ticket-invalidated',
                    orderGuid: 'order-1',
                    eventGuid: 'event-guid-1',
                    typeGuid: 'type-ticket-1',
                    barcode: 'BARCODE-001',
                    name: undefined,
                    nickname: undefined,
                    price: 4500,
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-02 12:00:00',
                    deleted: undefined,
                },
                {
                    guid: 'ticket-omitted',
                    orderGuid: 'order-1',
                    eventGuid: 'event-guid-1',
                    typeGuid: 'type-ticket-1',
                    barcode: 'BARCODE-002',
                    name: undefined,
                    price: 4500,
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-02 12:00:00',
                    deleted: undefined,
                },
                {
                    guid: 'ticket-already-deleted',
                    orderGuid: 'order-1',
                    eventGuid: 'event-guid-1',
                    typeGuid: 'type-ticket-1',
                    barcode: 'BARCODE-003',
                    name: undefined,
                    price: 4500,
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-02 12:00:00',
                    deleted: '2026-08-03 00:00:00',
                },
            ]);
            mockConnection.expect('selectManyRows', () => [
                {
                    guid: 'purchase-unchanged',
                    ticketGuid: 'ticket-unchanged',
                    orderGuid: 'order-1',
                    eventGuid: 'event-guid-1',
                    typeGuid: 'type-product-1',
                    name: undefined,
                    price: 1000,
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-02 12:00:00',
                    deleted: undefined,
                },
                {
                    guid: 'purchase-modified',
                    ticketGuid: undefined,
                    orderGuid: 'order-1',
                    eventGuid: 'event-guid-1',
                    typeGuid: 'type-product-1',
                    name: undefined,
                    price: 1000,
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-02 12:00:00',
                    deleted: undefined,
                },
                {
                    guid: 'purchase-ticket-omitted',
                    ticketGuid: 'ticket-omitted',
                    orderGuid: 'order-1',
                    eventGuid: 'event-guid-1',
                    typeGuid: 'type-product-1',
                    name: undefined,
                    price: 1000,
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-02 12:00:00',
                    deleted: undefined,
                },
                {
                    guid: 'purchase-order-omitted',
                    ticketGuid: undefined,
                    orderGuid: 'order-1',
                    eventGuid: 'event-guid-1',
                    typeGuid: 'type-product-1',
                    name: undefined,
                    price: 1000,
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-02 12:00:00',
                    deleted: undefined,
                },
                {
                    guid: 'purchase-already-deleted',
                    ticketGuid: undefined,
                    orderGuid: 'order-1',
                    eventGuid: 'event-guid-1',
                    typeGuid: 'type-product-1',
                    name: undefined,
                    price: 1000,
                    created: '2026-08-01 10:00:00',
                    updated: '2026-08-02 12:00:00',
                    deleted: '2026-08-03 00:00:00',
                },
            ]);

            mockConnection.expect('beginTransaction');
            mockConnection.expect('insert', (query, params) => {
                expect(query).toContain('insert into weeztix_orders');
                expect(params[0]).toBe('order-1');
                expect(params[3]).toBe('cancelled');
                expect(params[6]).toBe('2026-08-07 12:00:00');
                return 1;
            });
            mockConnection.expect('insert', (query, params) => {
                expect(query).toContain('insert into weeztix_tickets');
                expect(params[0]).toBe('ticket-invalidated');
                expect(params[5]).toBe('Alex Lee');
                expect(params[6]).toBeNull();
                expect(params[10]).toBe('2026-08-07 12:00:00');
                return 1;
            });
            mockConnection.expect('update', (query, params) => {
                expect(query).toContain('update weeztix_tickets set weeztix_ticket_deleted =');
                expect(query).toContain('weeztix_ticket_deleted is null');
                expect(params).toEqual([ 'order-1', 'ticket-omitted' ]);
                return 1;
            });
            mockConnection.expect('insert', (query, params) => {
                expect(query).toContain('insert into weeztix_purchases');
                expect(params[0]).toBe('purchase-modified');
                expect(params[1]).toBeNull();
                expect(params[6]).toBe(2000);
                expect(params[9]).toBe('2026-08-07 12:00:00');
                return 1;
            });
            mockConnection.expect('update', (query, params) => {
                expect(query).toContain('update weeztix_purchases set weeztix_purchase_deleted =');
                expect(query).toContain('weeztix_purchase_deleted is null');
                expect(params).toEqual([
                    'order-1',
                    'purchase-ticket-omitted',
                    'purchase-order-omitted',
                ]);
                return 1;
            });
            mockConnection.expect('commit');

            expect(await (task as any).importOrders('company-guid-1', 'event-guid-1')).toBe(true);
        });
    });

    describe('updateTaskIntervalForFestivalDate', () => {
        it('scales the task interval based on duration until the festival', () => {
            task.contextForTesting.setIntervalForRepeatingTask(
                WeeztixImportTask.kIntervalMaximum, /* force= */ true);

            const anonymousTask = task as any;

            anonymousTask.updateTaskIntervalForFestivalDate(
                Temporal.Now.zonedDateTimeISO('UTC').subtract({ days: 1 }));
            expect(task.contextForTesting.intervalMsForTesting).toBe(
                WeeztixImportTask.kIntervalMaximum);

            anonymousTask.updateTaskIntervalForFestivalDate(
                Temporal.Now.zonedDateTimeISO('UTC').add({ days: 5 }));
            expect(task.contextForTesting.intervalMsForTesting).toBe(3600 * 1000);

            anonymousTask.updateTaskIntervalForFestivalDate(
                Temporal.Now.zonedDateTimeISO('UTC').add({ days: 20 }));
            expect(task.contextForTesting.intervalMsForTesting).toBe(3 * 3600 * 1000);

            anonymousTask.updateTaskIntervalForFestivalDate(
                Temporal.Now.zonedDateTimeISO('UTC').add({ days: 45 }));
            expect(task.contextForTesting.intervalMsForTesting).toBe(6 * 3600 * 1000);

            anonymousTask.updateTaskIntervalForFestivalDate(
                Temporal.Now.zonedDateTimeISO('UTC').add({ days: 90 }));
            expect(task.contextForTesting.intervalMsForTesting).toBe(
                WeeztixImportTask.kIntervalMaximum);
        });
    });
});
