// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { LogMessage } from './LogMessage';

/**
 * Records the given `message` after the current Next.js request has finished.
 */
export function RecordAfterRequestFinished(builder: LogMessage): void {
    // todo
}

/**
 * Records the given `message` immediately, and block on the database write being complete.
 */
export async function RecordImmediately(builder: LogMessage): Promise<void> {
    // todo
}
