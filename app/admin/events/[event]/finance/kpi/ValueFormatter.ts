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
