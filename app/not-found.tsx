// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { ErrorPage } from './ErrorPage';

/**
 * Root component shown when the requested page could not be found..
 */
export default async function NotFoundPage() {
    return <ErrorPage statusCode={404} />;
}

export const metadata: Metadata = {
    title: 'Not found | AnimeCon Volunteering Teams',
};
