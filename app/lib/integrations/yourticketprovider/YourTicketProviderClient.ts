// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { YourTicketProviderOrganisersResponse, YourTicketProviderTicketsResponse } from './YourTicketProviderTypes';
import { kYourTicketProviderOrganisersResponse, kYourTicketProviderTicketsResponse } from './YourTicketProviderTypes';

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
    // CLEANUP:
    // ---------------------------------------------------------------------------------------------

    /**
     * Calls the /Organisers API, which returns a list of the organisers that the given API Key has
     * access to. This is used to avoid requiring user information for the service's health check.
     */
    async getOrganisers(): Promise<YourTicketProviderOrganisersResponse> {
        const url = `${this.#settings.endpoint}/Organisers?api_key=${this.#settings.apiKey}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: [
                [ 'Accept', 'application/json' ],
                [ 'Authorization', `${this.#settings.apiKey}`],
            ],
            next: {
                revalidate: /* seconds= */ 300,
            }
        });

        if (!response.ok)
            throw new Error(`Unable to call into the YTP API (${response.statusText})`);

        const unverifiedResponseJson = await response.json();
        const verifiedResponseJson =
            kYourTicketProviderOrganisersResponse.parse(unverifiedResponseJson);

        return verifiedResponseJson.value;
    }

    /**
     * Calls the /Event(<id>)/Tickets API, which returns all ticket types and (sub)products that
     * have been created for the event.
     */
    async listTicketsAndProducts(id: number): Promise<YourTicketProviderTicketsResponse> {
        const url =
            `${this.#settings.endpoint}/Events(${id})/Tickets?api_key=${this.#settings.apiKey}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: [
                [ 'Accept', 'application/json' ],
                [ 'Authorization', `${this.#settings.apiKey}`],
            ],
            next: {
                revalidate: /* seconds= */ 300,
            }
        });

        if (!response.ok)
            throw new Error(`Unable to call into the YTP API (${response.statusText})`);

        const unverifiedResponseJson = await response.json();
        const verifiedResponseJson =
            kYourTicketProviderTicketsResponse.parse(unverifiedResponseJson);

        return verifiedResponseJson.value;
    }
}
