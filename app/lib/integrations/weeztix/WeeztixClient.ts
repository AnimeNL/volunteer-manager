// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { z } from 'zod/v4';

import type { GetEventsResponse } from './WeeztixTypes';
import type { Temporal } from '@lib/Temporal';

import { kGetEventsResponse } from './WeeztixTypes';

/**
 * Settings required by the Weeztix integration.
 */
export interface WeeztixClientSettings {
    /**
     * Ephemeral access token through which requests can be authorized.
     */
    accessToken: {
        /**
         * Bearer token to include in the request.
         */
        token: string;

        /**
         * Time at which the token will expire.
         */
        expiration: Temporal.Instant;
    };

    /**
     * Longer term access token through which access tokens can be refreshed.
     */
    refreshToken: {
        /**
         * Bearer token to include in the request.
         */
        token: string;

        /**
         * Time at which the token will expire.
         */
        expiration: Temporal.Instant;
    };
}

/**
 * Properties set for a
 */
interface WeeztixRequest {
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
 * Endpoint that hosts the API. Apparently this *will* change.
 *
 * @see https://docs.weeztix.com/api/dashboard/dashboard
 */
const kEndpoint = 'https://api.weeztix.com';

/**
 * Client through which we communicate with the Weeztix API, utilising their REST endpoints.
 * 
 * @see https://docs.weeztix.com/api/dashboard/dashboard
 * @see https://docs.weeztix.com/docs/
 */
export class WeeztixClient {
    #settings: WeeztixClientSettings;

    constructor(settings: WeeztixClientSettings) {
        this.#settings = settings;
    }

    // ---------------------------------------------------------------------------------------------
    // Public APIs:
    // ---------------------------------------------------------------------------------------------

    /**
     * Lists events that are accessible with the authentication token, past and future. Soft deleted
     * events will be omitted from the listing.
     *
     * @throws An exception when the network request fails, or the response cannot be validated.
     * @returns Array of events that exist in our Weeztix account.
     */
    async listEvents(): Promise<GetEventsResponse> {
        return this.issueRequest(kGetEventsResponse, {
            api: '/event/normal',
            method: 'GET',
        });
    }

    // ---------------------------------------------------------------------------------------------
    // Internal behaviour:
    // ---------------------------------------------------------------------------------------------

    /**
     * Issues the given `request` on the Weeztix endpoint.
     *
     * Requests are made with the access token. When this has expired, a single OAuth request will
     * be attempted to obtain a new access token using the refresh token, which will be persisted in
     * settings when successful.
     *
     * The response will be validated based on the given `schema`, where failures will be considered
     * fatal and will thus throw an exception. The validated `T` will be returned.
     *
     * @param schema Schema to validate Weeztix' response with.
     * @param request Request to issue to Weeztix' endpoint.
     * @returns Validated response given by the Weeztix server.
     */
    private async issueRequest<T>(schema: z.ZodType<T>, request: WeeztixRequest): Promise<T> {
        // TODO: Renew the access token if initially expired.

        const endpoint = `${kEndpoint}${request.api}`;
        const response = await fetch(endpoint, {
            method: request.method,
            headers: {
                Authorization: `Bearer ${this.#settings.accessToken.token}`,
            },
        });

        // HTTP status codes that are not OK (i.e. not 2xx) signal that we did not get the expected
        // information back. HTTP 401 indicates that our access token no longer is valid, whereas
        // HTTP 403, HTTP 404 and 5xx indicate one of various other issues, which we do not retry.
        if (!response.ok) {
            if (response.status === 401 && !request.retry) {
                // TODO: Renew the access token when a 401 response is seen.
            }

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
