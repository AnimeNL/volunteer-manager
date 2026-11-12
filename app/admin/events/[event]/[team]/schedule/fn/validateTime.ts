// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Returns a time that is guaranteed to be valid. The `input` will be used when it confirms to the
 * "HH:MM" syntax, otherwise `defaultValue` will be returned.
 */
export function validateTime(input: string | undefined, defaultValue: string): string {
    if (/^\d{1,2}:[0-5][0-9]$/.test(input || ''))
        return input!;

    return defaultValue;
}
