// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { z } from 'zod/v4';

import * as ytp from './YourTicketProviderTypes';

/**
 * Settings required by the YourTicketProvider integration.
 */
export interface YourTicketProviderClientSettings {
    /**
     * API key that will be the authentication token for the YourTicketProvider Ticketing API
     * integration. This must be the API key by the event's owner; it's not sufficient to have
     * access to the event through another account.
     *
     * @see https://ytpstorage1.blob.core.windows.net/media/YTP%20Ticketing%20API%20Specifications.pdf
     */
    ticketingApiKey: string;

    /**
     * API key that will be the authentication token for the YourTicketProvider Visitor Information
     * API integration. This is a separate system for an unknown reason.
     *
     * @see https://ytpstorage1.blob.core.windows.net/media/VisitorInformationApi.pdf
     */
    visitorApiKey: string;

    /**
     * Endpoint through which the YourTicketProvider API can be reached.
     */
    endpoint: string;

    /**
     * Endpoint through which we can check YourTicketProvider's sales queue load.
     */
    queueEndpoint?: string;
}

/**
 * Properties that make up a request to the YourTicketProvider APIs.
 */
type YourTicketProviderRequest = ({
    /**
     * Pathname to the API that should be called, e.g. "/event".
     */
    api: string;

    /**
     * Full endpoint to the API that should be called, e.g. "https://foo.com/Endpoint".
     */
    endpoint?: never;

} | {
    /**
     * Pathname to the API that should be called, e.g. "/event".
     */
    api?: never;

    /**
     * Full endpoint to the API that should be called, e.g. "https://foo.com/Endpoint".
     */
    endpoint: string;

}) & {
    /**
     * Request method using which the API should be called.
     */
    method: 'DELETE' | 'GET' | 'POST' | 'PUT';

    /**
     * Request body that should be included with the API call.
     */
    body?: any;
};

/**
 * Properties necessary to issue a request to the Visitor Information API.
 *
 * @see https://ytpstorage1.blob.core.windows.net/media/VisitorInformationApi.pdf
 */
type VisitorInformationRequest =
    {
        /**
         * Type of request to issue to the API.
         */
        type: 'lastUpdated',

        /**
         * Time since which any updated purchases should be retrieved.
         */
        since: Temporal.ZonedDateTime;

        /**
         * Number of records to skip for pagination. (Should default to "0".)
         */
        skip: number;

        /**
         * Number of records to retrieve.
         */
        take: number;

    } |
    {
        /**
         * Type of request to issue to the API.
         */
        type: 'barcode',

        /**
         * Barcode to search for in the system.
         */
        barcode: string;
    };

/**
 * Maximum number of seconds we will wait prior to submitting a purchase. Any queueing times longer
 * than this value will throw an exception, and should be retried later.
 */
const kMaximumQueueWaitTimeSeconds = 15;

/**
 * The YourTicketProvider client integrates with the YTP Ticketing API to obtain information about
 * the products and tickets sold for particular events.
 *
 * @see https://ytpstorage1.blob.core.windows.net/media/YTP%20Ticketing%20API%20Specifications.pdf
 * @see https://www.yourticketprovider.nl/account/accountintegrations/ticketing-api
 */
export class YourTicketProviderClient {
    #settings: YourTicketProviderClientSettings;

    constructor(settings: YourTicketProviderClientSettings) {
        this.#settings = settings;
    }

    // ---------------------------------------------------------------------------------------------
    // Public APIs:
    // ---------------------------------------------------------------------------------------------

    /**
     * Creates a new ticket with the YourTicketProvider backend based on the given `request`.
     *
     * @throws An exception when the network request fails, or the response cannot be validated.
     * @returns Array of events that exist in our YourTicketProvider account.
     */
    async createTicket(eventId: number, request: ytp.CreateTicketRequest)
        : Promise<ytp.CreateTicketResponse>
    {
        // Parse the `request` to validate that correct input data has been given.
        const validatedRequest = ytp.kCreateTicketRequest.parse(request);

        const requiredQueueTime = await this.determineQueueTime(eventId);
        if (requiredQueueTime > kMaximumQueueWaitTimeSeconds) {
            throw new Error(
                `Requested to wait ${requiredQueueTime}s (max: ${kMaximumQueueWaitTimeSeconds}s)`);
        }

        // Wait for `requiredQueueTime` when a queue is in place and it's below the threshold at
        // which we're willing to wait for the purchase to complete.
        if (requiredQueueTime > 0) {
            console.info(`Waiting for ${requiredQueueTime}s to continue ticket purchase...`);
            await new Promise(resolve => setTimeout(resolve, requiredQueueTime * 1000));
        }

        return await this.issueRequest(ytp.kCreateTicketResponse, {
            api: '/Purchases',
            method: 'POST',
            body: validatedRequest,
        });
    }

    /**
     * Determines the queue time for a purchase request for the given `eventId`. The purchase queue
     * must be checked prior to filing a purchase, in line with YourTicketProvider's requirements.
     *
     * @param eventId ID of the event for which the queue duration is to be decided.
     * @throws An exception when the network request fails, or the response cannot be validated.
     * @returns Number of seconds we have to wait prior to making a purchase.
     */
    async determineQueueTime(eventId: number): Promise<number> {
        if (!this.#settings.queueEndpoint) {
            console.warn('[YTP] Ticket purchase queue confirmation has been disabled');
            return 0;
        }

        try {
            return (await this.issueRequest(ytp.kQueueNeededResponse, {
                endpoint: `${this.#settings.queueEndpoint}/${eventId}`,
                method: 'GET',
            })).queueTimeInSeconds;

        } catch (error: any) {
            console.warn(error);
        }

        // If we cannot determine the amount of time we're requested to wait, then wait one second
        // longer than the maximum wait time to abort the purchase.
        return kMaximumQueueWaitTimeSeconds + 1;
    }

    /**
     * Lists the events accessible for the current authentication token.
     *
     * @param organiserId ID of the organiser for whom event information should be listed.
     * @throws An exception when the network request fails, or the response cannot be validated.
     * @returns Array of events that exist in our YourTicketProvider account.
     */
    async listEvents(organiserId: number): Promise<ytp.OrganiserEventResponse> {
        return (await this.issueRequest(ytp.kOrganiserEventResponse, {
            api: `/Organisers(${organiserId})/Events`,
            method: 'GET',
        })).value;
    }

    /**
     * Lists the organisers accessible with the current authentication token.
     *
     * @throws An exception when the network request fails, or the response cannot be validated.
     * @returns Array of events that exist in our YourTicketProvider account.
     */
    async listOrganisers(): Promise<ytp.OrganisersResponse> {
        return (await this.issueRequest(ytp.kOrganisersResponse, {
            api: '/Organisers',
            method: 'GET',
        })).value;
    }

    /**
     * Lists both tickets and products that have been created for the given `eventId`.
     *
     * @throws An exception when the network request fails, or the response cannot be validated.
     * @returns Array of events that exist in our YourTicketProvider account.
     */
    async listTicketsAndProducts(id: number): Promise<ytp.TicketsResponse> {
        return (await this.issueRequest(ytp.kTicketsResponse, {
            api: `/Events(${id})/Tickets`,
            method: 'GET',
        })).value;
    }

    /**
     * Lists the tickets that have been issued for the given `eventId` and `ticketId`.
     *
     * @throws An exception when the network request fails, or the response cannot be validated.
     * @returns Array of tickets that exist in our YourTicketProvider account for this event.
     */
    async listTicketsForType(eventId: number, ticketTypeId: number) {
        // TODO: Implement this method.
        return [];
    }

    /**
     * Queries the Visitor Information API for the given `request`.
     *
     * @see https://ytpstorage1.blob.core.windows.net/media/VisitorInformationApi.pdf
     * @throws An exception when the network request fails, or the response cannot be validated.
     * @returns Array of purchases and tickets that are in scope of the request.
     */
    async queryVisitorInformation(externalEventId: string, request: VisitorInformationRequest) {
        if (!this.#settings.visitorApiKey)
            throw new Error('Unable to query the Visitor Information API without an API key');

        const endpointParams = new URLSearchParams();
        switch (request.type) {
            case 'barcode':
                endpointParams.set('barcode', request.barcode);
                break;

            case 'lastUpdated':
                endpointParams.set(
                    'lastUpdatedSince', request.since.toInstant().round('seconds').toString());
                endpointParams.set('skip', request.skip.toString());
                endpointParams.set('take', request.take.toString());
                break;
        }

        const endpointBaseUrl = 'https://www.yourticketprovider.nl/api/integration/products';
        const endpoint = `${endpointBaseUrl}/${externalEventId}/purchases?${endpointParams}`;

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: [
                [ 'Accept', 'application/json' ],
                [ 'Authorization', `Bearer ${this.#settings.visitorApiKey}` ],
            ],
        });

        if (!response.ok) {
            throw new Error(`Received HTTP ${response.status} response from ${endpoint}`, {
                cause: await response.json(),
            });
        }

        const unverifiedResponseJson = await response.json();

        // Validate the |unverifiedResponseJson| in accordance with the |schema| given to this
        // method. Exceptions are considered fatal, and it's up to the caller to recover.
        return ytp.kVisitorInformationResponse.parse(unverifiedResponseJson);
    }

    // ---------------------------------------------------------------------------------------------
    // Internal behaviour:
    // ---------------------------------------------------------------------------------------------

    /**
     * Issues the given `request` on the YourTicketProvider endpoint.
     *
     * Requests are made with an API key that does not expire. The response will be validated based
     * on the given `schema`, where failures will be considered fatal and will thus throw an
     * exception. The validated `T` will be returned.
     *
     * @param schema Schema to validate YourTicketProvider' response with.
     * @param request Request to issue to YourTicketProvider' endpoint.
     * @returns Validated response given by the YourTicketProvider server.
     */
    private async issueRequest<T>(schema: z.ZodType<T>, request: YourTicketProviderRequest)
        : Promise<T>
    {
        const composedEndpoint =
            `${this.#settings.endpoint}${request.api}?api_key=${this.#settings.ticketingApiKey}`;

        let body: BodyInit | undefined;
        let headers: HeadersInit = [
            [ 'Accept', 'application/json' ],
            [ 'Authorization', `${this.#settings.ticketingApiKey}` ],
        ];

        if (!!request.body) {
            body = JSON.stringify(request.body);
            headers = [ ...headers, [ 'Content-Type', 'application/json' ] ];
        }

        const endpoint = request.endpoint || composedEndpoint;
        const response = await fetch(endpoint, {
            method: request.method,
            headers,
            body,
        });

        if (!response.ok) {
            throw new Error(`Received HTTP ${response.status} response from ${endpoint}`, {
                cause: await response.json(),
            });
        }

        const unverifiedResponseJson = await response.json();

        // Validate the |unverifiedResponseJson| in accordance with the |schema| given to this
        // method. Exceptions are considered fatal, and it's up to the caller to recover.
        return schema.parse(unverifiedResponseJson);
    }
}
