// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { CancelTicketTask } from './CancelTicketTask';
import { TaskContext } from '../TaskContext';
import { useMockConnection } from '@lib/database/Connection';

const mockCreateTicketService = vi.fn();
const mockCancelOrder = vi.fn();

vi.mock('@lib/tickets', () => ({
    createTicketService: (...args: unknown[]) => mockCreateTicketService(...args),
}));

vi.mock('@lib/integrations/weeztix', () => ({
    createWeeztixClient: async () => ({
        cancelOrder: (...args: unknown[]) => mockCancelOrder(...args),
    }),
}));

describe('CancelTicketTask', () => {
    const mockConnection = useMockConnection();

    beforeEach(() => {
        mockCreateTicketService.mockReset();
        mockCancelOrder.mockReset();
    });

    function createTask() {
        const context = TaskContext.forEphemeralTask('CancelTicketTask', {});
        return new CancelTicketTask(context);
    }

    it('cancels a Weeztix order when all active tickets are volunteer, vendor, or guest',
        async () =>
    {
        mockCreateTicketService.mockResolvedValueOnce({ id: 'Weeztix' });
        mockCancelOrder.mockResolvedValueOnce({
            errors: {},
            notices: {},
            order_id: 'order-guid-1',
        });

        mockConnection.expect('selectOneRow', () => ({
            guestTicketGuid: 'guest-type-guid',
            vendorTicketGuid: 'vendor-type-guid',
            volunteerTicketGuid: 'volunteer-type-guid',
        }));

        mockConnection.expect('selectManyRows', () => [
            { guid: 'ticket-guid-1', typeGuid: 'volunteer-type-guid' },
            { guid: 'ticket-guid-2', typeGuid: 'guest-type-guid' },
        ]);

        mockConnection.expect('beginTransaction');
        mockConnection.expect('update', () => 1);
        mockConnection.expect('update', () => 2);
        mockConnection.expect('update', () => 0);
        mockConnection.expect('commit');

        const task = createTask();
        const result = await task.execute({
            event: '2026',
            orderId: 'order-guid-1',
            reason: 'Cancellation',
        });

        expect(result).toBe(true);
        expect(mockCancelOrder).toHaveBeenCalledWith('order-guid-1', {
            refund: false,
            comment: 'Cancelled via AnimeCon Volunteer Manager (volunteer cancellation)',
            includes_fees: false,
            entire_order: true,
            items: [
                { guid: 'ticket-guid-1', type: 'ticket' },
                { guid: 'ticket-guid-2', type: 'ticket' },
            ],
        });
    });

    it('refuses to cancel when any ticket in the order is not volunteer, vendor, or guest',
        async () =>
    {
        mockCreateTicketService.mockResolvedValueOnce({ id: 'Weeztix' });

        mockConnection.expect('selectOneRow', () => ({
            guestTicketGuid: 'guest-type-guid',
            vendorTicketGuid: 'vendor-type-guid',
            volunteerTicketGuid: 'volunteer-type-guid',
        }));

        mockConnection.expect('selectManyRows', () => [
            { guid: 'ticket-guid-1', typeGuid: 'volunteer-type-guid' },
            { guid: 'ticket-guid-2', typeGuid: 'visitor-type-guid' },
        ]);

        const task = createTask();
        const result = await task.execute({
            event: '2026',
            orderId: 'order-guid-1',
            reason: 'Manual',
        });

        expect(result).toBe(false);
        expect(mockCancelOrder).not.toHaveBeenCalled();
    });

    it('returns false without updating local database when Weeztix reports errors', async () => {
        mockCreateTicketService.mockResolvedValueOnce({ id: 'Weeztix' });
        mockCancelOrder.mockResolvedValueOnce({
            errors: {
                subjectType: 'Order',
                guid: 'order-guid-1',
                reason: 'Already cancelled',
            },
            notices: {},
        });

        mockConnection.expect('selectOneRow', () => ({
            guestTicketGuid: null,
            vendorTicketGuid: null,
            volunteerTicketGuid: 'volunteer-type-guid',
        }));

        mockConnection.expect('selectManyRows', () => [
            { guid: 'ticket-guid-1', typeGuid: 'volunteer-type-guid' },
        ]);

        const task = createTask();
        const result = await task.execute({
            event: '2026',
            orderId: 'order-guid-1',
            reason: 'Manual',
        });

        expect(result).toBe(false);
        expect(mockCancelOrder).toHaveBeenCalledWith('order-guid-1', {
            refund: false,
            comment: 'Cancelled via AnimeCon Volunteer Manager (manual)',
            includes_fees: false,
            entire_order: true,
            items: [
                { guid: 'ticket-guid-1', type: 'ticket' },
            ],
        });
    });
});
