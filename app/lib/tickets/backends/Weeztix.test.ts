// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import { Cache } from '@lib/cache';
import { Weeztix } from './Weeztix';
import { createWeeztixClient } from '@lib/integrations/weeztix';

const mockGetOrder = vi.fn();
const mockUpdateOrderReceiver = vi.fn();

vi.mock('@lib/integrations/weeztix', async importOriginal => {
    const actual = await importOriginal<typeof import('@lib/integrations/weeztix')>();
    return {
        ...actual,
        createWeeztixClient: vi.fn(async () => ({
            getOrder: mockGetOrder,
            updateOrderReceiver: mockUpdateOrderReceiver,
        })),
    };
});

describe('Weeztix', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        Cache.getInstance('TicketProvider').clear();
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('exposes structured capabilities reflecting the event configuration', () => {
        const withoutVolunteerTicket = new Weeztix('event-guid-1');
        expect(withoutVolunteerTicket.capabilities).toEqual({
            canCancelOrder: true,
            canCreateOrder: false,
            canFetchOrderDetails: true,
            canManageVolunteerTickets: false,
            canResendConfirmation: true,
            canUpdateOrder: true,
        });

        const withVolunteerTicket = new Weeztix('event-guid-1', 'company-guid', 'ticket-guid');
        expect(withVolunteerTicket.capabilities).toEqual({
            canCancelOrder: true,
            canCreateOrder: false,
            canFetchOrderDetails: true,
            canManageVolunteerTickets: true,
            canResendConfirmation: true,
            canUpdateOrder: true,
        });
    });

    it('fetches and caches purchase details in the TicketProvider cache', async () => {
        const service = new Weeztix('event-guid-1');

        mockGetOrder.mockResolvedValueOnce({
            guid: 'order-guid-1',
            email: '  jane.doe@example.com  ',
        });

        const first = await service.fetchPurchaseDetails('order-guid-1');
        expect(first).toEqual({ email: 'jane.doe@example.com' });
        expect(createWeeztixClient).toHaveBeenCalledTimes(1);
        expect(mockGetOrder).toHaveBeenCalledWith('order-guid-1');

        expect(Cache.getInstance('TicketProvider').get('weeztix/order/order-guid-1')).toEqual({
            order: { email: 'jane.doe@example.com' },
        });

        const second = await service.fetchPurchaseDetails('order-guid-1');
        expect(second).toEqual({ email: 'jane.doe@example.com' });
        expect(createWeeztixClient).toHaveBeenCalledTimes(1);
        expect(mockGetOrder).toHaveBeenCalledTimes(1);
    });

    it('caches orders that do not have an e-mail address set', async () => {
        const service = new Weeztix('event-guid-1');

        mockGetOrder.mockResolvedValueOnce({
            guid: 'order-guid-2',
            email: null,
        });

        const details = await service.fetchPurchaseDetails('order-guid-2');
        expect(details).toEqual({ email: undefined });
        expect(Cache.getInstance('TicketProvider').has('weeztix/order/order-guid-2')).toBe(true);
    });

    it('returns undefined without poisoning the cache when fetching fails', async () => {
        const service = new Weeztix('event-guid-1');

        mockGetOrder.mockRejectedValueOnce(new Error('Network error'));

        const first = await service.fetchPurchaseDetails('order-guid-3');
        expect(first).toBeUndefined();
        expect(Cache.getInstance('TicketProvider').has('weeztix/order/order-guid-3')).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

        mockGetOrder.mockResolvedValueOnce({
            guid: 'order-guid-3',
            email: 'recovered@example.com',
        });

        const second = await service.fetchPurchaseDetails('order-guid-3');
        expect(second).toEqual({ email: 'recovered@example.com' });
        expect(mockGetOrder).toHaveBeenCalledTimes(2);
    });

    it('updates the order e-mail address and refreshes the TicketProvider cache', async () => {
        const service = new Weeztix('event-guid-1');
        const cache = Cache.getInstance('TicketProvider');

        cache.set('weeztix/order/order-guid-4', {
            order: { email: 'old@example.com' },
        });

        mockUpdateOrderReceiver.mockResolvedValueOnce({
            guid: 'order-guid-4',
            email: 'new@example.com',
        });

        const result = await service.updatePurchaseEmail('order-guid-4', 'new@example.com');
        expect(result).toBe(true);
        expect(mockUpdateOrderReceiver).toHaveBeenCalledWith('order-guid-4', {
            email: 'new@example.com',
        });

        const cached = await service.fetchPurchaseDetails('order-guid-4');
        expect(cached).toEqual({ email: 'new@example.com' });
        expect(mockGetOrder).not.toHaveBeenCalled();
    });

    it('returns false and preserves cached details when updating fails', async () => {
        const service = new Weeztix('event-guid-1');
        const cache = Cache.getInstance('TicketProvider');

        cache.set('weeztix/order/order-guid-5', {
            order: { email: 'existing@example.com' },
        });

        mockUpdateOrderReceiver.mockRejectedValueOnce(new Error('HTTP 403'));

        const result = await service.updatePurchaseEmail('order-guid-5', 'new@example.com');
        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(cache.get('weeztix/order/order-guid-5')).toEqual({
            order: { email: 'existing@example.com' },
        });
    });
});
