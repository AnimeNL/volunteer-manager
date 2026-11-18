// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import { Instrumentation } from '../Instrumentation';
import { WeeztixClient, type WeeztixClientSettings } from './WeeztixClient';
import { writeSettings } from '@lib/Settings';

vi.mock('@lib/Settings', () => ({
    writeSettings: vi.fn(),
}));

describe('WeeztixClient', () => {
    let fetchSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();
        fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    const createSettings = (offsetSeconds: number): WeeztixClientSettings => ({
        accessToken: {
            token: 'initial-access-token',
            expiration: Temporal.Now.instant().add({ seconds: offsetSeconds }),
        },
        refreshToken: {
            token: 'initial-refresh-token',
            expiration: Temporal.Now.instant().add({ hours: 720 }),
        },
        clientId: 'myClientId',
        clientSecret: 'myClientSecret',
        companyId: 'company-guid-456',
    });

    it('issues request successfully without refresh when access token is valid', async () => {
        const client = new WeeztixClient(createSettings(100)); // token valid for 100s

        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([
            {
                guid: 'event-guid',
                company_id: 'company-guid-456',
                name: 'Event Name',
                location: { guid: 'loc-guid', name: 'Loc Name' },
            }
        ]), { status: 200 }));

        const events = await client.listEvents();
        expect(events).toHaveLength(1);
        expect(events[0].guid).toBe('event-guid');

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(fetchSpy).toHaveBeenCalledWith('https://api.weeztix.com/event/normal',
            expect.objectContaining({
                headers: {
                    Authorization: 'Bearer initial-access-token',
                },
            }));
    });

    it('refreshes token and retries if access token is initially expired', async () => {
        const client = new WeeztixClient(createSettings(-301)); // token expired 5m+1s ago

        // 1st fetch: token refresh endpoint
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            token_type: 'Bearer',
            expires_in: 3600,
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            refresh_token_expires_in: 86400,
        }), { status: 200 }));

        // 2nd fetch: API call (retry)
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([
            {
                guid: 'event-guid',
                company_id: 'company-guid-456',
                name: 'Event Name',
                location: { guid: 'loc-guid', name: 'Loc Name' },
            }
        ]), { status: 200 }));

        const events = await client.listEvents();
        expect(events).toHaveLength(1);

        expect(fetchSpy).toHaveBeenCalledTimes(2);

        // Assert token refresh call
        expect(fetchSpy.mock.calls[0][0]).toBe('https://auth.weeztix.com/tokens');
        expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({
            grant_type: 'refresh_token',
            client_id: 'myClientId',
            client_secret: 'myClientSecret',
            refresh_token: 'initial-refresh-token',
        });

        // Assert writeSettings call
        expect(writeSettings).toHaveBeenCalledTimes(1);
        expect(writeSettings).toHaveBeenCalledWith({
            'integration-weeztix-access-token': 'new-access-token',
            'integration-weeztix-access-token-expiration': expect.any(Number),
            'integration-weeztix-refresh-token': 'new-refresh-token',
            'integration-weeztix-refresh-token-expiration': expect.any(Number),
        });

        // Assert API retry call
        expect(fetchSpy.mock.calls[1][0]).toBe('https://api.weeztix.com/event/normal');
        expect(fetchSpy.mock.calls[1][1].headers).toEqual({
            Authorization: 'Bearer new-access-token',
        });
    });

    it('refreshes token and retries if API returns 401', async () => {
        const client = new WeeztixClient(createSettings(100)); // token valid, but server rejects

        // 1st fetch: API call returning 401
        fetchSpy.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

        // 2nd fetch: token refresh endpoint
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            token_type: 'Bearer',
            expires_in: 3600,
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            refresh_token_expires_in: 86400,
        }), { status: 200 }));

        // 3rd fetch: API call (retry)
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([
            {
                guid: 'event-guid',
                company_id: 'company-guid-456',
                name: 'Event Name',
                location: { guid: 'loc-guid', name: 'Loc Name' },
            }
        ]), { status: 200 }));

        const events = await client.listEvents();
        expect(events).toHaveLength(1);

        expect(fetchSpy).toHaveBeenCalledTimes(3);

        // Assert 1st call (API)
        expect(fetchSpy.mock.calls[0][0]).toBe('https://api.weeztix.com/event/normal');

        // Assert 2nd call (Refresh)
        expect(fetchSpy.mock.calls[1][0]).toBe('https://auth.weeztix.com/tokens');

        // Assert 3rd call (API Retry)
        expect(fetchSpy.mock.calls[2][0]).toBe('https://api.weeztix.com/event/normal');
        expect(fetchSpy.mock.calls[2][1].headers).toEqual({
            Authorization: 'Bearer new-access-token',
        });
    });

    it('throws error if API returns 401 on retry', async () => {
        const client = new WeeztixClient(createSettings(100));

        // 1st fetch: API call returning 401
        fetchSpy.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

        // 2nd fetch: token refresh endpoint
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            token_type: 'Bearer',
            expires_in: 3600,
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            refresh_token_expires_in: 86400,
        }), { status: 200 }));

        // 3rd fetch: API retry call returning 401 again
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            error: 'still unauthorized'
        }), { status: 401 }));

        await expect(client.listEvents()).rejects.toThrow('Received HTTP 401 response');
        expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('generalises event GUIDs in instrumentation operations for listTicketTypes', async () => {
        const withContextSpy = vi.spyOn(Instrumentation, 'withContext');
        const client = new WeeztixClient(createSettings(100));

        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([
            {
                guid: 'ticket-guid',
                event_id: 'event-guid-123',
                name: 'Weekend Ticket',
                min_price: 5000,
                available_stock: 100,
                sold_count: 10,
                scanned_count: 0,
                created_at: '2026-05-01T10:00:00+00:00',
                updated_at: '2026-05-02T10:00:00+00:00',
                status: 'available',
                products: [],
            },
        ]), { status: 200 }));

        const tickets = await client.listTicketTypes('event-guid-123');
        expect(tickets).toHaveLength(1);

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.weeztix.com/event/event-guid-123/ticket/products',
            expect.objectContaining({
                method: 'GET',
            }));

        expect(withContextSpy).toHaveBeenCalledWith({
            integration: 'Weeztix',
            operation: 'https://api.weeztix.com/event/<Id>/ticket/products',
        });
    });

    it('retrieves event and order details with generalised instrumentation paths', async () => {
        const withContextSpy = vi.spyOn(Instrumentation, 'withContext');
        const client = new WeeztixClient(createSettings(100));

        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            guid: 'event-guid-123',
            company_id: 'company-guid-456',
            name: 'AnimeCon 2026',
        }), { status: 200 }));

        const event = await client.getEvent('event-guid-123');
        expect(event.company_id).toBe('company-guid-456');

        expect(withContextSpy).toHaveBeenCalledWith({
            integration: 'Weeztix',
            operation: 'https://api.weeztix.com/event/<Id>',
        });

        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            guid: 'order-guid-789',
            email: 'jane.doe@example.com',
            firstName: 'Jane',
            lastName: 'Doe',
            fullname: 'Jane Doe',
            locale: 'en_GB',
            status: 'paid',
            finn_price: 4500,
            tickets: [
                {
                    guid: 'order-ticket-1',
                    ticket_number: '9988776655',
                },
            ],
        }), { status: 200 }));

        const order = await client.getOrder('order-guid-789');
        expect(order.guid).toBe('order-guid-789');
        expect(order.email).toBe('jane.doe@example.com');
        expect(order.firstName).toBe('Jane');
        expect(order.lastName).toBe('Doe');
        expect(order.fullname).toBe('Jane Doe');
        expect(order.locale).toBe('en_GB');
        expect(order.status).toBe('paid');
        expect(order.tickets).toHaveLength(1);

        expect(withContextSpy).toHaveBeenCalledWith({
            integration: 'Weeztix',
            operation: 'https://api.weeztix.com/order/<Id>',
        });
    });

    it('posts order statistics queries and unwraps hit sources', async () => {
        const withContextSpy = vi.spyOn(Instrumentation, 'withContext');
        const client = new WeeztixClient(createSettings(100));

        const mockOrder = {
            guid: 'order-newer',
            status: 'paid',
            fullname: 'Jane Doe',
            created_at: '2026-05-01T12:00:00+00:00',
            updated_at: '2026-05-02T12:00:00+00:00',
            products: [],
            tickets: [],
            tech_data: {},
        };

        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            hits: {
                total: 1,
                hits: [
                    {
                        _source: mockOrder,
                    },
                ],
            },
        }), { status: 200 }));

        const orders = await client.listOrders({
            offset: 0,
            limit: 100,
            timeunit: 'year',
            range_applies_to: 'updated_at',
            start: '2026-04-01T00:00:00+00:00',
            end: '2026-05-03T00:00:00+00:00',
            sorting: { updated_at: 'desc' },
            events: [ 'event-guid-123' ],
        });

        expect(orders).toEqual([ mockOrder ]);

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.weeztix.com/statistics/orders/company-guid-456',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    Authorization: 'Bearer initial-access-token',
                    'Content-Type': 'application/json',
                },
            }));

        expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({
            offset: 0,
            limit: 100,
            timeunit: 'year',
            range_applies_to: 'updated_at',
            start: '2026-04-01T00:00:00+00:00',
            end: '2026-05-03T00:00:00+00:00',
            sorting: { updated_at: 'desc' },
            events: [ 'event-guid-123' ],
        });

        expect(withContextSpy).toHaveBeenCalledWith({
            integration: 'Weeztix',
            operation: 'https://api.weeztix.com/statistics/orders/<Id>',
        });
    });

    it('returns true for empty OK responses when schema is undefined', async () => {
        const client = new WeeztixClient(createSettings(100));
        const issueRequest = (client as unknown as {
            issueRequest: (
                schema: undefined,
                request: { api: string; method: 'GET' },
            ) => Promise<boolean>;
        }).issueRequest.bind(client);

        fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
        await expect(issueRequest(undefined, {
            api: '/order/order-guid-789/resend',
            method: 'GET',
        })).resolves.toBe(true);

        fetchSpy.mockResolvedValueOnce(new Response('Server Error', { status: 500 }));
        await expect(issueRequest(undefined, {
            api: '/order/order-guid-789/resend',
            method: 'GET',
        })).rejects.toThrow('Received HTTP 500 response');
    });

    it('resends confirmation e-mails for a given orderId', async () => {
        const client = new WeeztixClient(createSettings(100));

        fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
        await expect(client.resendConfirmationEmail('order-guid-789')).resolves.toBe(true);

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.weeztix.com/order/order-guid-789/resend',
            expect.objectContaining({
                method: 'GET',
                headers: {
                    Authorization: 'Bearer initial-access-token',
                },
            }));
    });

    it('updates order receiver information with generalised instrumentation paths', async () => {
        const withContextSpy = vi.spyOn(Instrumentation, 'withContext');
        const client = new WeeztixClient(createSettings(100));

        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            guid: 'order-guid-789',
            email: 'updated@example.com',
            firstName: 'Jane',
            lastName: 'Doe',
            fullname: 'Jane Doe',
            status: 'paid',
        }), { status: 200 }));

        const order = await client.updateOrderReceiver('order-guid-789', {
            email: 'updated@example.com',
        });

        expect(order.guid).toBe('order-guid-789');
        expect(order.email).toBe('updated@example.com');

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.weeztix.com/order/order-guid-789',
            expect.objectContaining({
                method: 'PUT',
                headers: {
                    Authorization: 'Bearer initial-access-token',
                    'Content-Type': 'application/json',
                },
            }));

        expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({
            email: 'updated@example.com',
        });

        expect(withContextSpy).toHaveBeenCalledWith({
            integration: 'Weeztix',
            operation: 'https://api.weeztix.com/order/<Id>',
        });

        await expect(client.updateOrderReceiver('order-guid-789', {
            email: 'not-an-email',
        })).rejects.toThrow();

        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('creates and updates ticket metadata with generalised instrumentation paths', async () => {
        const withContextSpy = vi.spyOn(Instrumentation, 'withContext');
        const client = new WeeztixClient(createSettings(100));

        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            guid: 'order-metadata-guid-1',
            metadata_id: 'meta-nickname-id',
            value: 'Kira',
        }), { status: 200 }));

        const created = await client.createOrderTicketMetadata('order-guid-789', 'ticket-guid-1', {
            metadata_id: 'meta-nickname-id',
            value: 'Kira',
        });

        expect(created).toEqual({
            guid: 'order-metadata-guid-1',
            metadata_id: 'meta-nickname-id',
            value: 'Kira',
        });

        expect(fetchSpy).toHaveBeenNthCalledWith(
            1,
            'https://api.weeztix.com/order/order-guid-789/tickets/ticket-guid-1/metadata',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    Authorization: 'Bearer initial-access-token',
                    'Content-Type': 'application/json',
                },
            }));

        expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({
            metadata_id: 'meta-nickname-id',
            value: 'Kira',
        });

        expect(withContextSpy).toHaveBeenCalledWith({
            integration: 'Weeztix',
            operation: 'https://api.weeztix.com/order/<Id>/tickets/<Id>/metadata',
        });

        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            guid: 'order-metadata-guid-1',
            metadata_id: 'meta-nickname-id',
            value: '',
        }), { status: 200 }));

        const updated = await client.updateOrderTicketMetadata(
            'order-guid-789', 'ticket-guid-1', 'order-metadata-guid-1', { value: '' });

        expect(updated).toEqual({
            guid: 'order-metadata-guid-1',
            metadata_id: 'meta-nickname-id',
            value: '',
        });

        expect(fetchSpy).toHaveBeenNthCalledWith(
            2,
            'https://api.weeztix.com/order/order-guid-789/tickets/ticket-guid-1/metadata/' +
                'order-metadata-guid-1',
            expect.objectContaining({
                method: 'PUT',
                headers: {
                    Authorization: 'Bearer initial-access-token',
                    'Content-Type': 'application/json',
                },
            }));

        expect(JSON.parse(fetchSpy.mock.calls[1][1].body)).toEqual({ value: '' });

        expect(withContextSpy).toHaveBeenCalledWith({
            integration: 'Weeztix',
            operation: 'https://api.weeztix.com/order/<Id>/tickets/<Id>/metadata/<Id>',
        });

        await expect(client.createOrderTicketMetadata('order-guid-789', 'ticket-guid-1', {
            metadata_id: '',
            value: 'Kira',
        })).rejects.toThrow();

        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
});
