// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { YourTicketProviderImportTask } from './YourTicketProviderImportTask';
import { TaskContext } from '../TaskContext';
import { useMockConnection } from '@lib/database/Connection';

const mockListTicketsAndProducts = vi.fn();

vi.mock('@lib/integrations/yourticketprovider', () => ({
    createYourTicketProviderClient: async () => ({
        listTicketsAndProducts: mockListTicketsAndProducts,
    }),
}));

describe('YourTicketProviderImportTask', () => {
    const mockConnection = useMockConnection();

    let task: YourTicketProviderImportTask;

    beforeEach(async () => {
        mockListTicketsAndProducts.mockReset();
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
});
