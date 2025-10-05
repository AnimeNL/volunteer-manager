// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { createContext } from 'react';

/**
 * Signature of a listener function that will be called when a request has been issued.
 */
export type AuthenticationContextListener = (authFlowRedirectUrl?: string) => void;

/**
 * Manages the authentication context. The provider of the context should
 */
export class AuthenticationContextManager {
    #listeners = new Set<AuthenticationContextListener>();

    /**
     * Attaches the given `listener` to receive events when a request has been issued.
     */
    attachRequestListener(listener: AuthenticationContextListener) {
        this.#listeners.add(listener);
    }

    /**
     * Detaches the given `listener` from events fired when a request has been issued.
     */
    detachRequestListener(listener: AuthenticationContextListener) {
        this.#listeners.delete(listener);
    }

    /**
     * Requests the authentication flow to be opened. All attached listeners will be informed.
     */
    requestAuthenticationFlow(authFlowRedirectUrl?: string) {
        for (const listener of this.#listeners)
            listener(authFlowRedirectUrl);
    }
}

/**
 * Use of the AuthenticationContext.
 */
export const AuthenticationContext =
    createContext<AuthenticationContextManager>(new AuthenticationContextManager);
