// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { z } from 'zod/v4';

import type { GetEventsResponse } from './WeeztixTypes';
import { writeSettings } from '@lib/Settings';

import { kGetEventsResponse, kRefreshTokenResponse } from './WeeztixTypes';

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

    /**
     * Unique ID assigned to our client.
     */
    clientId: string;

    /**
     * Secret used to authenticate our client.
     */
    clientSecret: string;
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
const kWeeztixApiEndpoint = 'https://api.weeztix.com';

/**
 * Endpoint through which access tokens can be obtained.
 *
 * @see https://docs.weeztix.com/docs/introduction/authentication/refresh-token
 */
const kWeeztixTokenRefreshEndpoint = 'https://auth.weeztix.com/tokens';

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
        const currentInstant = Temporal.Now.instant();
        const expirationInstant = currentInstant.subtract({ minutes: 5 });

        // Automatically refresh the access token when it either as expired, or is due to expire in
        // the near future. We do this to avoid unnecessary roundtrips on 401 responses.
        if (Temporal.Instant.compare(expirationInstant, this.#settings.accessToken.expiration) >= 0)
            return this.refreshToken(schema, request);

        const endpoint = `${kWeeztixApiEndpoint}${request.api}`;
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
            if (response.status === 401 && !request.retry)
                return this.refreshToken(schema, request);

            throw new Error(`Received HTTP ${response.status} response from ${endpoint}`, {
                cause: await response.json(),
            });
        }

        const unverifiedResponseJson = await response.json();

        // Validate the |unverifiedResponseJson| in accordance with the |schema| given to this
        // method. Exceptions are considered fatal, and it's up to the caller to recover.
        return schema.parse(unverifiedResponseJson);
    }

    /**
     * Attempts to refresh the access token using the refresh token. When successful, the new
     * tokens will be persisted in settings and the database, and the original request will be
     * retried with the retry flag set to true.
     *
     * @param schema Original schema to validate Weeztix' API response with.
     * @param request Original request to issue to Weeztix' endpoint after token refresh.
     * @returns Validated response given by the Weeztix server if token renewal was successful.
     */
    private async refreshToken<T>(schema: z.ZodType<T>, request: WeeztixRequest): Promise<T> {
        if (request.retry)
            throw new Error(`Multiple token refresh attempts for ${request.api}, aborting`);

        // Issue a token refresh attempt to the Weeztix endpoint.
        const response = await fetch(kWeeztixTokenRefreshEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                grant_type: 'refresh_token',
                client_id: this.#settings.clientId,
                client_secret: this.#settings.clientSecret,
                refresh_token: this.#settings.refreshToken.token,
            }),
        });

        // HTTP status codes that are not OK signal that the token could not be refreshed at all.
        // This is fatal, and we will not retry either the refresh or the API.
        if (!response.ok) {
            throw new Error(`Received HTTP ${response.status} response during token refresh`, {
                cause: await response.json(),
            });
        }

        const unverifiedResponseJson = await response.json();
        const verifiedResponse = kRefreshTokenResponse.parse(unverifiedResponseJson);

        const accessToken = verifiedResponse.access_token;
        const accessTokenExpiration = Temporal.Now.instant().add({
            seconds: verifiedResponse.expires_in
        });

        const refreshToken = verifiedResponse.refresh_token;
        const refreshTokenExpiration = Temporal.Now.instant().add({
            seconds: verifiedResponse.refresh_token_expires_in
        });

        await writeSettings({
            'integration-weeztix-access-token': accessToken,
            'integration-weeztix-access-token-expiration': accessTokenExpiration.epochMilliseconds,
            'integration-weeztix-refresh-token': refreshToken,
            'integration-weeztix-refresh-token-expiration':
                refreshTokenExpiration.epochMilliseconds,
        });

        // Replace the internal state of this instance with the new token information, which will
        // allow us to immediately (re)issue the request with the newly obtained token.
        this.#settings.accessToken = {
            token: accessToken,
            expiration: accessTokenExpiration,
        };

        this.#settings.refreshToken = {
            token: refreshToken,
            expiration: refreshTokenExpiration,
        };

        // Re-issue the request now that a refreshed token is available. We expect it to succeed.
        return this.issueRequest<T>(schema, { ...request, retry: true });
    }
}
