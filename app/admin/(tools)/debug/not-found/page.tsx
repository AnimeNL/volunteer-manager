// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * Debugging page that triggers the HTTP 404 Not Found page.
 */
export default async function DebugNotFoundPage() {
    await requireAuthentication('system.internals.debug');

    notFound();
}
