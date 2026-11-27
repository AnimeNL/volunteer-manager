// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Builds a case-insensitive regular expression matching `title` on token boundaries, tolerating
 * differences in whitespace runs and dash characters (`-`, `–`, `—`).
 */
function buildTitlePattern(title: string): RegExp {
    const escaped = title
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/[-–—]/g, '[-–—]')
        .replace(/\s+/g, '\\s+');

    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
}

/**
 * Formats a ticket price given in `cents` as a compact EUR label (e.g. `€20` or `€12.50`).
 */
export function formatEuroPrice(cents: number): string {
    const euros = cents / 100;
    return Number.isInteger(euros) ? `€${euros}` : `€${euros.toFixed(2)}`;
}

/**
 * Strips a redundant `activityTitle` (including any generic prefix preceding it, such as
 * `"Events Ticket: "`) as well as leading separators and `"on "` from a ticket product name.
 */
export function formatTicketProductName(productName: string, activityTitle: string): string {
    const trimmedProduct = productName.trim();
    const trimmedTitle = activityTitle.trim();
    const match = trimmedTitle ? buildTitlePattern(trimmedTitle).exec(trimmedProduct) : null;

    if (match) {
        const after = trimmedProduct.slice(match.index + match[0].length)
            .replace(/^[\s\-–—:,|/]+/, '')
            .replace(/^\(([^()]+)\)$/, '$1')
            .replace(/^on\s+/i, '')
            .trim();

        if (after)
            return after;

        const before = trimmedProduct.slice(0, match.index)
            .replace(/[\s\-–—:,|/]+$/, '')
            .trim();

        if (before)
            return before;
    }

    return trimmedProduct.replace(/^on\s+/i, '').trim() || trimmedProduct;
}

/**
 * Formats a count with a singular or plural noun label (e.g. `1 ticket` or `3 tickets`).
 */
export function pluralize(
    count: number, singular: string, plural: string = `${singular}s`): string
{
    return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}
