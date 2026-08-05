// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { YourTicketProviderImportTask } from './YourTicketProviderImportTask';
import { TaskContext } from '../TaskContext';
import { useMockConnection } from '@lib/database/Connection';

const mockListTicketsAndProducts = vi.fn();
const mockQueryVisitorInformation = vi.fn();
const mockFetchPurchase = vi.fn();
const mockFetchPurchaseItems = vi.fn();

vi.mock('@lib/integrations/yourticketprovider', () => ({
    createYourTicketProviderClient: async () => ({
        listTicketsAndProducts: mockListTicketsAndProducts,
        queryVisitorInformation: mockQueryVisitorInformation,
        fetchPurchase: mockFetchPurchase,
        fetchPurchaseItems: mockFetchPurchaseItems,
    }),
}));

describe('YourTicketProviderImportTask', () => {
    const mockConnection = useMockConnection();

    let task: YourTicketProviderImportTask;

    beforeEach(async () => {
        mockListTicketsAndProducts.mockReset();
        mockQueryVisitorInformation.mockReset();
        mockFetchPurchase.mockReset();
        mockFetchPurchaseItems.mockReset();
        const context = TaskContext.forEphemeralTask('YourTicketProviderImportTask', {});
        task = new YourTicketProviderImportTask(context);
        await (task as any).initialise();
    });

    it('returns false when no tickets are returned by the API', async () => {
        mockListTicketsAndProducts.mockResolvedValueOnce([]);

        const result = await (task as any).importTicketTypes(123, []);
        expect(result).toBe(false);
    });

    it('inserts a new ticket when it is not in the database / known list', async () => {
        const liveTickets = [
            {
                Id: 1001,
                EventId: 123,
                Name: 'Regular Ticket',
                Price: 4500,
                Amount: 500,
                SoldOut: false,
                Live: true,
                IsSubproduct: false,
                SalesStart: '2026-08-01T10:00:00Z',
                SalesEnd: '2026-08-10T18:00:00Z',
            }
        ];
        mockListTicketsAndProducts.mockResolvedValueOnce(liveTickets);

        mockConnection.expect('beginTransaction');
        mockConnection.expect('insert', (query, params) => {
            expect(query).toContain('insert into your_ticket_provider_tickets');
            expect(query).toContain('on duplicate key update');
            expect(params[0]).toBe(1001); // ytpTicketId
            expect(params[1]).toBe(123);  // ytpTicketEventId
            expect(params[2]).toBe('Regular Ticket'); // ytpTicketName
            expect(params[3]).toBe(4500); // ytpTicketPrice
            expect(params[4]).toBe(500);  // ytpTicketAmount
            expect(params[5]).toBe(0);    // ytpTicketSoldOut (false -> 0)
            expect(params[6]).toBe(1);    // ytpTicketLive (true -> 1)
            expect(params[7]).toBe(0);    // ytpTicketIsSubproduct (false -> 0)
            expect(params[8]).toBe('2026-08-01 10:00:00'); // ytpTicketSalesStart
            expect(params[9]).toBe('2026-08-10 18:00:00'); // ytpTicketSalesEnd
            return 1;
        });
        mockConnection.expect('commit');

        const result = await (task as any).importTicketTypes(123, []);
        expect(result).toBe(true);
    });

    it('keeps ytpTicketUpdated unchanged when an existing ticket matches the live ticket exactly', async () => {
        const updatedTime = Temporal.Instant.from('2026-08-01T12:00:00Z').toZonedDateTimeISO('UTC');
        const salesStart = Temporal.Instant.from('2026-08-01T10:00:00Z').toZonedDateTimeISO('UTC');
        const salesEnd = Temporal.Instant.from('2026-08-10T18:00:00Z').toZonedDateTimeISO('UTC');

        const knownTickets = [
            {
                id: 1001,
                Name: 'Regular Ticket',
                Price: 4500,
                Amount: 500,
                SoldOut: false,
                Live: true,
                IsSubProduct: false,
                SalesStart: salesStart,
                SalesEnd: salesEnd,
                Updated: updatedTime,
            }
        ];

        const liveTickets = [
            {
                Id: 1001,
                EventId: 123,
                Name: 'Regular Ticket',
                Price: 4500,
                Amount: 500,
                SoldOut: false,
                Live: true,
                IsSubproduct: false,
                SalesStart: '2026-08-01T10:00:00Z',
                SalesEnd: '2026-08-10T18:00:00Z',
            }
        ];
        mockListTicketsAndProducts.mockResolvedValueOnce(liveTickets);

        mockConnection.expect('beginTransaction');
        mockConnection.expect('insert', (query, params) => {
            // Check that the existing updatedTime ('2026-08-01 12:00:00') is passed in the parameters.
            const updatedParamIndex = params.findIndex(p => typeof p === 'string' && p.includes('2026-08-01 12:00:00'));
            expect(updatedParamIndex).toBeGreaterThanOrEqual(0);
            return 1;
        });
        mockConnection.expect('commit');

        const result = await (task as any).importTicketTypes(123, knownTickets);
        expect(result).toBe(true);
    });

    it('changes ytpTicketUpdated to the current time if any field changed on an existing ticket', async () => {
        const updatedTime = Temporal.Instant.from('2026-08-01T12:00:00Z').toZonedDateTimeISO('UTC');
        const salesStart = Temporal.Instant.from('2026-08-01T10:00:00Z').toZonedDateTimeISO('UTC');
        const salesEnd = Temporal.Instant.from('2026-08-10T18:00:00Z').toZonedDateTimeISO('UTC');

        const knownTickets = [
            {
                id: 1001,
                Name: 'Regular Ticket',
                Price: 4500,
                Amount: 500,
                SoldOut: false,
                Live: true,
                IsSubProduct: false,
                SalesStart: salesStart,
                SalesEnd: salesEnd,
                Updated: updatedTime,
            }
        ];

        // Let's change the price from 4500 to 5000:
        const liveTickets = [
            {
                Id: 1001,
                EventId: 123,
                Name: 'Regular Ticket',
                Price: 5000, // changed!
                Amount: 500,
                SoldOut: false,
                Live: true,
                IsSubproduct: false,
                SalesStart: '2026-08-01T10:00:00Z',
                SalesEnd: '2026-08-10T18:00:00Z',
            }
        ];
        mockListTicketsAndProducts.mockResolvedValueOnce(liveTickets);

        mockConnection.expect('beginTransaction');
        mockConnection.expect('insert', (query, params) => {
            // Verify that the parameters do NOT contain the old '2026-08-01 12:00:00'.
            const oldUpdatedParamIndex = params.findIndex(p => typeof p === 'string' && p.includes('2026-08-01 12:00:00'));
            expect(oldUpdatedParamIndex).toBe(-1);
            return 1;
        });
        mockConnection.expect('commit');

        const result = await (task as any).importTicketTypes(123, knownTickets);
        expect(result).toBe(true);
    });

    it('soft deletes known tickets that are no longer returned in the live tickets list', async () => {
        const updatedTime = Temporal.Instant.from('2026-08-01T12:00:00Z').toZonedDateTimeISO('UTC');
        const salesStart = Temporal.Instant.from('2026-08-01T10:00:00Z').toZonedDateTimeISO('UTC');
        const salesEnd = Temporal.Instant.from('2026-08-10T18:00:00Z').toZonedDateTimeISO('UTC');

        const knownTickets = [
            {
                id: 1001,
                Name: 'Regular Ticket',
                Price: 4500,
                Amount: 500,
                SoldOut: false,
                Live: true,
                IsSubProduct: false,
                SalesStart: salesStart,
                SalesEnd: salesEnd,
                Updated: updatedTime,
            },
            {
                id: 1002, // This ticket is no longer active and will be soft deleted!
                Name: 'Old Ticket',
                Price: 3000,
                Amount: 100,
                SoldOut: true,
                Live: false,
                IsSubProduct: false,
                SalesStart: salesStart,
                SalesEnd: salesEnd,
                Updated: updatedTime,
            }
        ];

        // API returns only 1001:
        const liveTickets = [
            {
                Id: 1001,
                EventId: 123,
                Name: 'Regular Ticket',
                Price: 4500,
                Amount: 500,
                SoldOut: false,
                Live: true,
                IsSubproduct: false,
                SalesStart: '2026-08-01T10:00:00Z',
                SalesEnd: '2026-08-10T18:00:00Z',
            }
        ];
        mockListTicketsAndProducts.mockResolvedValueOnce(liveTickets);

        mockConnection.expect('beginTransaction');
        // Expect insert for 1001:
        mockConnection.expect('insert', () => 1);
        // Expect update for soft deleting 1002:
        mockConnection.expect('update', (query, params) => {
            expect(query).toContain('update your_ticket_provider_tickets set ytp_ticket_deleted =');
            expect(query).toContain('where ytp_ticket_id = ? and ytp_ticket_deleted is null');
            expect(params[0]).toBe(1002);
            return 1;
        });
        mockConnection.expect('commit');

        const result = await (task as any).importTicketTypes(123, knownTickets);
        expect(result).toBe(true);
    });

    describe('importPurchases', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('returns false when no purchases are returned by the Visitor Information API', async () => {
            mockQueryVisitorInformation.mockResolvedValueOnce([]);

            const result = await (task as any).importPurchases(123, 'ext-event-id');
            expect(result).toBe(false);
        });

        it('skips updating when no changes are identified in the purchase', async () => {
            const livePurchases = [
                {
                    id: 'purchase-12345',
                    productId: 'prod-101',
                    reference: 'REF12345',
                    date: '2026-08-05T12:00:00Z',
                    lastUpdated: '2026-08-05T12:05:00Z',
                    tickets: [
                        {
                            id: 'ticket-99001',
                            ticketTypeId: '1001',
                            barcode: '1234567890123',
                            source: 'Webshop',
                            status: 'Valid',
                            lastUpdated: '2026-08-05T12:05:00Z',
                            basicInformation: {
                                firstname: 'John',
                                lastname: 'Doe',
                            },
                        }
                    ]
                }
            ];
            mockQueryVisitorInformation.mockResolvedValueOnce(livePurchases);

            mockConnection.expect('selectManyRows', () => {
                return [
                    {
                        id: 12345,
                        tickets: [
                            {
                                barcode: '1234567890123',
                                complimentary: false,
                                cancelled: null,
                                holder: 'John Doe',
                            }
                        ]
                    }
                ];
            });

            const result = await (task as any).importPurchases(123, 'ext-event-id');
            expect(result).toBe(true);

            expect(mockFetchPurchase).not.toHaveBeenCalled();
            expect(mockFetchPurchaseItems).not.toHaveBeenCalled();
        });

        it('updates the purchase when a change is identified', async () => {
            const livePurchases = [
                {
                    id: 'purchase-12345',
                    productId: 'prod-101',
                    reference: 'REF12345',
                    date: '2026-08-05T12:00:00Z',
                    lastUpdated: '2026-08-05T12:05:00Z',
                    tickets: [
                        {
                            id: 'ticket-99001',
                            ticketTypeId: '1001',
                            barcode: '1234567890123',
                            source: 'Webshop',
                            status: 'Cancelled',
                            lastUpdated: '2026-08-05T12:05:00Z',
                            basicInformation: {
                                firstname: 'John',
                                lastname: 'Doe',
                            },
                        }
                    ]
                }
            ];
            mockQueryVisitorInformation.mockResolvedValueOnce(livePurchases);

            mockConnection.expect('selectManyRows', () => {
                return [
                    {
                        id: 12345,
                        tickets: [
                            {
                                barcode: '1234567890123',
                                complimentary: false,
                                cancelled: null,
                                holder: 'John Doe',
                            }
                        ]
                    }
                ];
            });

            const mockPurchase = {
                Id: 12345,
                EventId: 123,
                TotalAmount: 4500,
                PaidDate: '2026-08-05T12:00:00Z',
                Cancelled: true,
                HasAcceptedTermsAndAgreements: true,
            };
            const mockItems = [
                {
                    Id: 99001,
                    TicketId: 1001,
                    Barcode: 1234567890123,
                    TicketHolderFirstname: 'John',
                    TicketHolderInsertion: null,
                    TicketHolderLastname: 'Doe',
                }
            ];

            mockFetchPurchase.mockResolvedValueOnce(mockPurchase);
            mockFetchPurchaseItems.mockResolvedValueOnce(mockItems);

            mockConnection.expect('beginTransaction');
            mockConnection.expect('insert', (query, params) => {
                expect(query).toContain('insert into your_ticket_provider_purchases');
                expect(params[0]).toBe(12345);
                expect(params[1]).toBe(123);
                expect(params[2]).toBe(0);
                return 1;
            });
            mockConnection.expect('commit');

            const resultPromise = (task as any).importPurchases(123, 'ext-event-id');
            await vi.runAllTimersAsync();
            const result = await resultPromise;

            expect(result).toBe(true);
            expect(mockFetchPurchase).toHaveBeenCalledWith(12345);
            expect(mockFetchPurchaseItems).toHaveBeenCalledWith(12345);
        });

        it('inserts a new purchase when it is not in the database', async () => {
            const livePurchases = [
                {
                    id: 'purchase-67890',
                    productId: 'prod-102',
                    reference: 'REF67890',
                    date: '2026-08-05T12:00:00Z',
                    lastUpdated: '2026-08-05T12:05:00Z',
                    tickets: [
                        {
                            id: 'ticket-99002',
                            ticketTypeId: '1002',
                            barcode: '9876543210987',
                            source: 'GuestList',
                            status: 'Valid',
                            lastUpdated: '2026-08-05T12:05:00Z',
                            basicInformation: {
                                firstname: 'Jane',
                                lastname: 'Smith',
                            },
                        }
                    ]
                }
            ];
            mockQueryVisitorInformation.mockResolvedValueOnce(livePurchases);

            mockConnection.expect('selectManyRows', () => {
                return [];
            });

            const mockPurchase = {
                Id: 67890,
                EventId: 123,
                TotalAmount: 0,
                PaidDate: '2026-08-05T12:00:00Z',
                Cancelled: false,
                HasAcceptedTermsAndAgreements: true,
            };
            const mockItems = [
                {
                    Id: 99002,
                    TicketId: 1002,
                    Barcode: 9876543210987,
                    TicketHolderFirstname: 'Jane',
                    TicketHolderInsertion: 'de',
                    TicketHolderLastname: 'Smith',
                }
            ];

            mockFetchPurchase.mockResolvedValueOnce(mockPurchase);
            mockFetchPurchaseItems.mockResolvedValueOnce(mockItems);

            mockConnection.expect('beginTransaction');
            mockConnection.expect('insert', (query, params) => {
                expect(query).toContain('insert into your_ticket_provider_purchases');
                expect(params[0]).toBe(67890);
                expect(params[1]).toBe(123);
                expect(params[2]).toBe(1);
                expect(params[3]).toBeUndefined();
                expect(params[4]).toBe('2026-08-05 12:00:00');
                expect(params[5]).toBe(99002);
                expect(params[6]).toBe(1002);
                expect(params[7]).toBe('9876543210987');
                expect(params[8]).toBe('Jane de Smith');
                return 1;
            });
            mockConnection.expect('commit');

            const resultPromise = (task as any).importPurchases(123, 'ext-event-id');
            await vi.runAllTimersAsync();
            const result = await resultPromise;

            expect(result).toBe(true);
            expect(mockFetchPurchase).toHaveBeenCalledWith(67890);
            expect(mockFetchPurchaseItems).toHaveBeenCalledWith(67890);
        });
    });
});
