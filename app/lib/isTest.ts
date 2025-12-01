// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Returns whether a test is currently running.
 */
export function isTest() {
    return process.env.VITEST_POOL_ID !== undefined;
}
