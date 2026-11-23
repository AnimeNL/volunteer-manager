// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { SetRecordErrorLogDeferDelegate } from '@lib/ErrorLog';
import { buildAuthenticationContext } from '@lib/auth/AuthenticationTestHelpers';
import { useMockConnection } from '@lib/database/Connection';

import { associatePurchase, cancelPurchase, createAssociateTicket } from './TicketActions';

const mockCreateTicketService = vi.fn();
const mockCancelTicketExecuteNow = vi.fn();
const mockForbidden = vi.fn(() => { throw new Error('NEXT_FORBIDDEN'); });

let currentGrants = 'event.visible,volunteers.tickets';

vi.mock('next/headers', () => ({
    headers: async () => new Headers(),
}));

vi.mock('next/navigation', () => ({
    forbidden: () => mockForbidden(),
    notFound: () => { throw new Error('NEXT_NOT_FOUND'); },
    unauthorized: () => { throw new Error('NEXT_UNAUTHORIZED'); },
}));

vi.mock('@lib/auth', async importOriginal => {
    const actual = await importOriginal<typeof import('@lib/auth')>();

    return {
        ...actual,
        getAuthenticationContext: async () => buildAuthenticationContext({
            access: {
                grants: currentGrants,
                events: '*',
                teams: '*',
            },
            user: {
                id: 7,
                firstName: 'Admin',
                lastName: 'User',
                name: 'Admin User',
                nameOrFirstName: 'Admin',
                username: 'admin@animecon.nl',
            },
        }),
    };
});

vi.mock('@lib/cache', async importOriginal => {
    const actual = await importOriginal<typeof import('@lib/cache')>();
    return {
        ...actual,
        getEvent: async (slug: string) => ({
            id: 42,
            slug,
            shortName: 'AnimeCon 2026',
            tickets: {
                volunteerTicketId: 'vol-ticket-1',
            },
        }),
    };
});

vi.mock('@lib/tickets', () => ({
    createTicketService: (...args: unknown[]) => mockCreateTicketService(...args),
}));

vi.mock('@lib/scheduler/tasks/CancelTicketTask', () => ({
    CancelTicketTask: {
        ExecuteNow: (...args: unknown[]) => mockCancelTicketExecuteNow(...args),
    },
}));

vi.mock('@lib/log', () => ({
    LogBuilder: {
        for: () => {
            const builder = {
                withAffectedUser: () => builder,
                withCondition: () => builder,
                withInitiatorUser: () => builder,
                withSeverity: () => builder,
                record: vi.fn(),
            };
            return builder;
        },
    },
}));

describe('TicketActions', () => {
    const mockConnection = useMockConnection();

    beforeEach(() => {
        currentGrants = 'event.visible,volunteers.tickets';
        mockCreateTicketService.mockReset();
        mockCancelTicketExecuteNow.mockReset();
        mockForbidden.mockClear();
        SetRecordErrorLogDeferDelegate(async () => undefined);
    });

    afterEach(() => {
        SetRecordErrorLogDeferDelegate(undefined);
    });

    it('forbids non-root users from cancelling non-volunteer purchases', async () => {
        mockCreateTicketService.mockResolvedValueOnce({
            id: 'Weeztix',
            capabilities: { canCancelOrder: true },
            fetchPurchase: async () => ({
                cancelled: false,
                tickets: [ { ticketId: 'visitor-ticket-99', holder: 'Visitor' } ],
            }),
        });

        const result = await cancelPurchase('2026', 'order-1');
        expect(result.success).toBe(false);
        expect(mockForbidden).toHaveBeenCalledTimes(1);
        expect(mockCancelTicketExecuteNow).not.toHaveBeenCalled();
    });

    it('rejects cancelling a purchase that is already cancelled', async () => {
        mockCreateTicketService.mockResolvedValueOnce({
            id: 'Weeztix',
            capabilities: { canCancelOrder: true },
            fetchPurchase: async () => ({
                cancelled: true,
                tickets: [ { ticketId: 'vol-ticket-1', holder: 'Alice' } ],
            }),
        });

        const result = await cancelPurchase('2026', 'order-1');
        expect(result).toEqual({
            success: false,
            error: 'This purchase has already been cancelled.',
        });
        expect(mockCancelTicketExecuteNow).not.toHaveBeenCalled();
    });

    it('disassociates linked volunteers and cancels the order via CancelTicketTask', async () => {
        mockCreateTicketService.mockResolvedValueOnce({
            id: 'Weeztix',
            capabilities: { canCancelOrder: true },
            fetchPurchase: async () => ({
                cancelled: false,
                tickets: [ { ticketId: 'vol-ticket-1', holder: 'Alice' } ],
            }),
        });

        mockConnection.expect('selectOneColumnManyRows', () => [ 101 ]);
        mockConnection.expect('delete', () => 1);
        mockCancelTicketExecuteNow.mockResolvedValueOnce(true);

        const result = await cancelPurchase('2026', 'order-1');
        expect(result).toEqual({
            success: true,
            close: true,
            redirect: '/admin/events/2026/tickets/associates/order-1',
            refresh: true,
        });
        expect(mockCancelTicketExecuteNow).toHaveBeenCalledWith({
            event: '2026',
            orderId: 'order-1',
            reason: 'Manual',
        });
    });

    it('associates a purchase with a volunteer and rejects duplicates', async () => {
        mockCreateTicketService.mockResolvedValue({ id: 'Weeztix' });

        mockConnection.expect('insert', () => 1);
        const created = await associatePurchase('2026', 'order-2', { userId: 55 });
        expect(created).toEqual({
            success: true,
            redirect: '/admin/events/2026/tickets/volunteers/55',
        });

        mockConnection.expect('insert', () => 0);
        const duplicate = await associatePurchase('2026', 'order-2', { userId: 55 });
        expect(duplicate).toEqual({
            success: false,
            error: 'Unable to associate the ticket, do they already have one?',
        });
    });

    it('creates an associate ticket and falls back gracefully if immediate import fails', async () => {
        const importPurchase = vi.fn().mockRejectedValueOnce(new Error('timeout'));
        mockCreateTicketService.mockResolvedValueOnce({
            id: 'Weeztix',
            capabilities: { canCreateOrder: true },
            createTicket: async () => ({ purchaseId: 'order-99' }),
            importPurchase,
        });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const result = await createAssociateTicket('2026', {
            firstName: 'Bob',
            lastName: 'Builder',
            email: 'bob@example.com',
        });
        consoleErrorSpy.mockRestore();

        expect(result).toEqual({
            success: true,
            message:
                'The ticket has been created, but it could not be imported into our system. ' +
                'Please allow up to 24 hours for it to appear.',
        });
    });
});
