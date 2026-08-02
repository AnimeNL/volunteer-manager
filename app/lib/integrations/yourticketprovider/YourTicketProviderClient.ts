// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { z } from 'zod/v4';

import * as ytp from './YourTicketProviderTypes';

/**
 * Settings required by the YourTicketProvider integration.
 */
export interface YourTicketProviderClientSettings {
    /**
     * API key that will be the authentication token for the YourTicketProvider API integration.
     * This must be the API key by the event's owner; it's not sufficient to have access to the
     * event through another account.
     */
    apiKey: string;

    /**
     * Endpoint through which the YourTicketProvider API can be reached.
     */
    endpoint: string;
}

/**
 * Properties that make up a request to the YourTicketProvider APIs.
 */
interface YourTicketProviderRequest {
    /**
     * Pathname to the API that should be called, e.g. "/event".
     */
    api: string;

    /**
     * Request method using which the API should be called.
     */
    method: 'DELETE' | 'GET' | 'POST' | 'PUT';

    /**
     * Whether this request is a retry following a (necessary) refresh of the access token.
     */
    retry?: boolean;
}

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
    async createTicket(eventId: number, request: unknown) {
        // TODO: Implement this method.
        return undefined;
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
        const endpoint = `${this.#settings.endpoint}${request.api}?api_key=${this.#settings.apiKey}`;
        const response = await fetch(endpoint, {
            method: request.method,
            headers: {
                Accept: 'application/json',
                Authorization: `${this.#settings.apiKey}`,
            },
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
