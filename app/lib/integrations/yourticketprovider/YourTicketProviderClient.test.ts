// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import { Instrumentation } from '../Instrumentation';
import { YourTicketProviderClient, type YourTicketProviderClientSettings }
    from './YourTicketProviderClient';

describe('YourTicketProviderClient', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;
    let withContextSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, 'fetch');
        withContextSpy = vi.spyOn(Instrumentation, 'withContext');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const kDefaultSettings: YourTicketProviderClientSettings = {
        ticketingApiKey: 'secret-ticketing-key',
        visitorApiKey: 'secret-visitor-key',
        endpoint: 'https://api.yourticketprovider.nl',
        queueEndpoint: 'https://queue.yourticketprovider.nl',
    };

    it('issues Ticketing API requests and strips api_key from instrumentation operations', async () => {
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            value: [
                {
                    Id: 42,
                    FirstName: 'Anime',
                    LastName: 'Con',
                    Email: 'info@animecon.nl',
                    ApiKey: null,
                },
            ],
        }), { status: 200 }));

        const client = new YourTicketProviderClient(kDefaultSettings);
        const organisers = await client.listOrganisers();

        expect(organisers).toHaveLength(1);
        expect(organisers[0].Id).toBe(42);

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.yourticketprovider.nl/Organisers?api_key=secret-ticketing-key',
            expect.objectContaining({
                method: 'GET',
                headers: [
                    [ 'Accept', 'application/json' ],
                    [ 'Authorization', 'secret-ticketing-key' ],
                ],
            }));

        expect(withContextSpy).toHaveBeenCalledWith({
            integration: 'YourTicketProvider',
            operation: 'https://api.yourticketprovider.nl/Organisers',
        });
    });

    it('includes JSON bodies and Content-Type headers on mutation requests', async () => {
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

        const client = new YourTicketProviderClient(kDefaultSettings);
        await client.postUpdatePurchase(999, {
            Email: 'updated@animecon.nl',
            IncludeTicketGuarantee: false,
            HasAcceptedTermsAndAgreements: true,
        });

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.yourticketprovider.nl/Purchases(999)?api_key=secret-ticketing-key',
            expect.objectContaining({
                method: 'PUT',
                headers: [
                    [ 'Accept', 'application/json' ],
                    [ 'Authorization', 'secret-ticketing-key' ],
                    [ 'Content-Type', 'application/json' ],
                ],
                body: JSON.stringify({
                    Email: 'updated@animecon.nl',
                    IncludeTicketGuarantee: false,
                    HasAcceptedTermsAndAgreements: true,
                }),
            }));
    });

    it('throws with the response body as cause when the Ticketing API returns non-2xx', async () => {
        fetchSpy.mockResolvedValueOnce(new Response('Invalid purchase ID', { status: 404 }));

        const client = new YourTicketProviderClient(kDefaultSettings);
        await expect(client.getPurchase(1234)).rejects.toThrow(
            expect.objectContaining({
                message: expect.stringContaining('Received HTTP 404 response'),
                cause: 'Invalid purchase ID',
            }));
    });

    it('checks the sales queue before creating a ticket and aborts when the queue is too long', async () => {
        // (1) Queue time exceeds 15 seconds -> abort before calling /Purchases.
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            queueTimeInSeconds: 20,
        }), { status: 200 }));

        const client = new YourTicketProviderClient(kDefaultSettings);
        await expect(client.createTicket(100, {
            EventId: 100,
            Email: 'volunteer@animecon.nl',
            IncludeTicketGuarantee: false,
            Language: 'NL',
            Complimentary: true,
            HasAcceptedTermsAndAgreements: true,
            PurchaseItems: [
                {
                    TicketId: 5,
                    TicketHolderEmail: 'volunteer@animecon.nl',
                    TicketHolderFirstname: 'Jane',
                    TicketHolderLastname: 'Doe',
                },
            ],
        })).rejects.toThrow('Requested to wait 20s (max: 15s)');

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(fetchSpy.mock.calls[0][0]).toBe('https://queue.yourticketprovider.nl/100');

        // (2) Queue time is 0 -> proceeds to POST /Purchases.
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            queueTimeInSeconds: 0,
        }), { status: 200 }));

        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            Id: 777,
            EventId: 100,
            IsTicketClaimRequired: false,
            TotalAmount: 0,
            Reference: 'REF777',
            Secret: 'secret',
            Paid: true,
            PaidDate: '2026-06-01T12:00:00Z',
            Complimentary: true,
            Cancelled: false,
        }), { status: 200 }));

        const created = await client.createTicket(100, {
            EventId: 100,
            Email: 'volunteer@animecon.nl',
            IncludeTicketGuarantee: false,
            Language: 'NL',
            Complimentary: true,
            HasAcceptedTermsAndAgreements: true,
            PurchaseItems: [],
        });

        expect(created.Id).toBe(777);
        expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('queries the Visitor Information API and sorts results by lastUpdated ascending', async () => {
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([
            {
                id: 'p-2',
                productId: 'prod-1',
                reference: 'REF200',
                date: '2026-06-01T10:00:00Z',
                lastUpdated: '2026-06-02T12:00:00Z',
                tickets: [],
            },
            {
                id: 'p-1',
                productId: 'prod-1',
                reference: 'REF100',
                date: '2026-06-01T09:00:00Z',
                lastUpdated: '2026-06-01T12:00:00Z',
                tickets: [],
            },
        ]), { status: 200 }));

        const client = new YourTicketProviderClient(kDefaultSettings);
        const results = await client.queryVisitorInformation('ext-event-1', {
            type: 'lastUpdated',
            since: Temporal.ZonedDateTime.from('2026-06-01T00:00:00Z[UTC]'),
            skip: 0,
            take: 50,
        });

        expect(results.map(item => item.reference)).toEqual([ 'REF100', 'REF200' ]);

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://www.yourticketprovider.nl/api/integration/products/ext-event-1/purchases' +
            '?lastUpdatedSince=2026-06-01T00%3A00%3A00Z&skip=0&take=50',
            expect.objectContaining({
                method: 'GET',
                headers: [
                    [ 'Accept', 'application/json' ],
                    [ 'Authorization', 'Bearer secret-visitor-key' ],
                ],
            }));

        expect(withContextSpy).toHaveBeenCalledWith({
            integration: 'YourTicketProvider',
            operation:
                'https://www.yourticketprovider.nl/api/integration/products/ext-event-1/purchases',
        });
    });
});
