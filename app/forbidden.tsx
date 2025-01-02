// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { ErrorPage } from './ErrorPage';

/**
 * Root component shown when the signed in user has no access to the requested page.
 */
export default async function ForbiddenPage() {
    return (
        <ErrorPage statusCode={403} />
    );
}

export const metadata: Metadata = {
    title: 'No access | AnimeCon Volunteering Teams',
};
