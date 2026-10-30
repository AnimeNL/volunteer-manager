// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { unauthorized } from 'next/navigation';

import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * Debugging page that triggers the HTTP 401 Unauthorized page.
 */
export default async function DebugUnauthorizedPage() {
    await requireAuthentication('system.internals.debug');

    unauthorized();
}
