// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { v4 as uuid } from 'uuid';

/**
 * Mimics (synchronous) NanoID behaviour using the UUID library. Returns a string of random numbers
 * and letters of the given `size`.
 *
 * @see https://github.com/ai/nanoid/issues/365
 * @todo Switch back to `nanoid` when we can depend on it w/o breaking tests, which have issues
 *       between Vitest and ESM modules.
 */
export function nanoid(size: number): string {
    return uuid().replaceAll('-', '').slice(0, size);
}
