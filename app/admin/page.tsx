// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { default as TopLevelLayout } from './TopLevelLayout';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';


/**
 * Main dashboard of the AnimeCon Volunteer Manager. Includes various cards in a masonry layout that
 * give an overview of what's going on. Exact cards depend on the user's access level.
 */
export default async function AdminPage() {
    await requireAuthenticationContext({ check: 'admin' });

    return (
        <TopLevelLayout>
            <span>Hello, world.</span>
        </TopLevelLayout>
    );
}

export const metadata: Metadata = {
    title: 'AnimeCon Volunteer Manager',
};
