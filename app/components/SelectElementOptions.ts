// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ShirtFit, ShirtSize } from '@lib/database/Types';
import { kShirtFit, kShirtSize } from '@lib/database/Types';

/**
 * Options for a <SelectElement> for binary answers.
 */
export const kBooleanOptions = [
    { id: 1, label: 'Yes' },
    { id: 0, label: 'No' },
];

/**
 * Options for a <SelectElement> for t-shirt fit options.
 */
export const kTShirtFitOptions: { id: ShirtFit, label: string }[] =
    Object.values(kShirtFit).map(fit => ({ id: fit, label: fit }));

/**
 * Options for a <SelectElement> for t-shirt size options.
 */
export const kTShirtSizeOptions: { id: ShirtSize, label: string }[] = [
    { id: kShirtSize.XS, label: 'XS' },
    { id: kShirtSize.S, label: 'Small' },
    { id: kShirtSize.M, label: 'Medium' },
    { id: kShirtSize.L, label: 'Large' },
    { id: kShirtSize.XL, label: 'XL' },
    { id: kShirtSize.XXL, label: 'XXL' },
    { id: kShirtSize['3XL'], label: '3XL' },
    { id: kShirtSize['4XL'], label: '4XL' },
];
