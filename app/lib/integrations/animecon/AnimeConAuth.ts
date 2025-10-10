// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { revalidateTag } from 'next/cache';

/**
 * Settings required for authenticating with the AnimeCon API.
 */
export interface AnimeConAuthSettings {
    /**
     * Endpoint at which we can authenticate our client usage.
     */
    authEndpoint: string;

    /**
     * ID of our client with the AnimeCon API.
     */
    clientId: string;

    /**
     * Secret of our client with the AnimeCon API.
     */
    clientSecret: string;

    /**
     * Username through which we identify with the AnimeCon API.
     */
    username: string;

    /**
     * Password through which we identify with the AnimeCon API.
     */
    password: string;

    /**
     * Whether the authentication cache should be revalidated.
     */
    revalidateCache?: boolean;

    /**
     * Scopes for which we are will authenticate with the auth endpoint. Must be a comma-separated
     * list, e.g. "foo, bar, baz".
     */
    scopes: string;
}

/**
 * Details that will be returned when an authentication token has been obtained from the AnimeCon
 * Authentication service.
 */
export interface ClientAuthToken {
    /**
     * Type of token that has been returned from the authentication service.
     */
    tokenType: 'Bearer';

    /**
     * The actual authentication token that has been obtained, in a URL-safe base64 encoded format.
     */
    token: string;

    /**
     * The OAuth refresh token. This would allow us to refresh tokens without user interaction,
     * however since we authenticate with a username and password this isn't relevant.
     */
    refreshToken: string;

    /**
     * Number of seconds after which the token will expire. Should be ~an hour at minimum, ~a day
     * at most, depending on the exact JWT configuration.
     */
    ttl: number;
}

/**
 * Next.js revalidation token used to cache authentication information.
 * @see https://nextjs.org/docs/app/api-reference/functions/fetch#optionsnextrevalidate
 */
const kNextRevalidationToken = 'animecon-api';

/**
 * Authentication driver for the AnimeCon API. Will make an OAuth2 request to the indicated endpoint
 * to obtain a JWT token, which in turn can be used to authenticate further requests.
 */
export class AnimeConAuth {
    #fetch: typeof globalThis.fetch;

    #authEndpoint: string;
    #clientId: string;
    #clientSecret: string;
    #username: string;
    #password: string;
    #scopes: string;

    constructor(fetch: typeof globalThis.fetch, settings: AnimeConAuthSettings) {
        this.#fetch = fetch;

        this.#authEndpoint = settings.authEndpoint;
        this.#clientId = settings.clientId;
        this.#clientSecret = settings.clientSecret;
        this.#username = settings.username;
        this.#password = settings.password;
        this.#scopes = settings.scopes;

        if (settings.revalidateCache)
            revalidateTag(kNextRevalidationToken, 'max');
    }

    /**
     * Authenticates with the AnimeCon authentication service based on teh configured information.
     * NextJS caching in `fetch()` will be used to automatically cache the value of the response for
     * about a day, to prevent us from revalidating too frequently.
     */
    async authenticate(): Promise<ClientAuthToken | undefined> {
        const requestPayload = new FormData();
        requestPayload.set('grant_type', 'password');
        requestPayload.set('client_id', this.#clientId);
        requestPayload.set('client_secret', this.#clientSecret);
        requestPayload.set('username', this.#username);
        requestPayload.set('password', this.#password);
        requestPayload.set('scopes', this.#scopes);

        const response = await this.#fetch(this.#authEndpoint, {
            method: 'POST',
            headers: [
                [ 'Accept', '*/*' ],
            ],
            body: requestPayload,
            next: {
                revalidate: /* seconds= */ 1800,
                tags: [ kNextRevalidationToken ],
            },
        });

        if (!response.ok)
            return undefined;

        const responsePayload = await response.json();
        if (!Object.hasOwn(responsePayload, 'token_type') ||
            !Object.hasOwn(responsePayload, 'expires_in') ||
            !Object.hasOwn(responsePayload, 'access_token') ||
            !Object.hasOwn(responsePayload, 'refresh_token'))
        {
            throw new Error('Invalid authentication token obtained from the AnimeCon server.');
        }

        if (responsePayload['token_type'] !== 'Bearer')
            throw new Error('Expected a bearer token from the AnimeCon server');

        return {
            tokenType: responsePayload['token_type'],
            token: responsePayload['access_token'],
            refreshToken: responsePayload['refresh_token'],
            ttl: responsePayload['expires_in'],
        };
    }
}
