// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Formatting rules to apply when formatting a revenue figure.
 */
const kRevenueFormat = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/**
 * Formatting rules to apply when formatting a quantative sales figure.
 */
const kSalesFormat = new Intl.NumberFormat('en-GB');

/**
 * Formats the given `figure` according to the preferred `format`.
 */
export function formatMetric(figure: number, format: 'revenue' | 'sales', subject?: string) {
    const suffix = !!subject? ` ${subject}` : '';
    switch (format) {
        case 'revenue':
            return kRevenueFormat.format(figure) + suffix;

        case 'sales':
            return kSalesFormat.format(figure) + suffix;
    }

    throw new Error(`Invalid format rule requested: "${format}"`);
}

/**
 * Formats the difference between the `figure` and the `reference` as a percentage.
 */
export function formatDifference(figure: number, reference: number): string {
    if (!reference) {
        if (!figure)
            return /* no data: */ '=';

        return /* no comparable results: */ '+100%';
    }

    const difference = (figure - reference) / reference;
    const differencePct = Math.round(difference * 100);

    return differencePct > 0 ? `+${differencePct}%`
                             : `${differencePct}%`;
}

/**
 * Formats the given `figure` with an optional `T-remainingDays` suffix for historical comparisons.
 */
export function formatMetricReference(
    figure: number, format: 'revenue' | 'sales', remainingDays: number, subject?: string): string
{
    const formattedMetric = formatMetric(figure, format, subject);
    if (remainingDays > 0)
        return `${formattedMetric} @ T-${remainingDays} days`;

    return formattedMetric;
}
