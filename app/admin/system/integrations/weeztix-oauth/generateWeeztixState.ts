// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { hash } from 'node:crypto';

/**
 * Weeztix supports a "state" to enable soft authentication for OAuth responses. We generate an
 * encrypted value based on the signed in user, and the current build of the Volunteer Manager.
 * 
 * @param userId Unique ID of the user who is going through the Weeztix authentication flow.
 */
export async function generateWeeztixState(userId: number) {
    const buildHash = process.env.SOURCE_COMMIT;
    return hash('sha256', `${userId}${buildHash}`, 'base64url').substring(0, 12);
}
