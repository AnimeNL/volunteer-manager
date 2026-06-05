// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { createContext } from 'react';

/**
 * Type of the <AdminClientContext> details.
 */
export interface TAdminClientContext {
    /**
     * Whether the signed in user has the ability to make silent mutations.
     */
    allowSilentMutations: boolean;

    /**
     * Whether the signed in user has the ability to access account pages.
     */
    canAccessAccounts: boolean;

    /**
     * Whether the page is being rendered using the new layout version.
     */
    isLayoutV2: boolean;

    /**
     * Whether the page is being rendered on a mobile device.
     */
    isMobile: boolean;
}

/**
 * The `FormProviderContext` signals information about the form submission to child components, for
 * example to enable an interactive submission flow to be created.
 */
export const AdminClientContext = createContext<TAdminClientContext>({
    allowSilentMutations: false,
    canAccessAccounts: false,
    isLayoutV2: false,
    isMobile: false,
});
