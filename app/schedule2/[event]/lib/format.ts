// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Formats a ticket price given in `cents` as a compact EUR label (e.g. `€20` or `€12.50`).
 */
export function formatEuroPrice(cents: number): string {
    const euros = cents / 100;
    return Number.isInteger(euros) ? `€${euros}` : `€${euros.toFixed(2)}`;
}

/**
 * Formats a count with a singular or plural noun label (e.g. `1 ticket` or `3 tickets`).
 */
export function pluralize(
    count: number, singular: string, plural: string = `${singular}s`): string
{
    return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}
