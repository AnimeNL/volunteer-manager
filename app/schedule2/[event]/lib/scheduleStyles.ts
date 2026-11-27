// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Theme } from '@mui/material/styles';

/**
 * Builds a CSS `color-mix(in srgb, ...)` expression mixing `percent`% of `color` into `base`.
 */
export function mixColor(color: string, percent: number, base = 'transparent'): string {
    return `color-mix(in srgb, ${color} ${percent}%, ${base})`;
}

/**
 * Returns the subtle hairline divider colour shared by conjoined schedule lists and category cards.
 */
export function subtleDividerBorder(theme: Theme): string {
    return `1px solid ${mixColor((theme.vars || theme).palette.divider, 65)}`;
}

/**
 * Returns the recessed surface colour for past schedule rows and muted list containers.
 */
export function mutedRowSurface(theme: Theme): string {
    const palette = (theme.vars || theme).palette;
    return mixColor(palette.text.primary, 4.5, palette.m3.sheet);
}

/**
 * Returns the elevated hover surface colour for standalone paper cards and segmented list rows.
 */
export function cardHoverSurface(theme: Theme): string {
    const palette = (theme.vars || theme).palette;
    return mixColor(palette.background.paper, 94, palette.text.primary);
}

/**
 * Returns light and dark elevation shadows for floating M3 Expressive navigation and refresh pills.
 */
export function floatingPillShadow(theme: Theme, variant: 'indicator' | 'nav') {
    const lightBlur = variant === 'nav' ? '20px' : '14px';
    const lightAlpha = variant === 'nav' ? 0.14 : 0.18;
    const darkBlur = variant === 'nav' ? '20px' : '16px';
    const darkBorderAlpha = variant === 'nav' ? 0.07 : 0.08;

    return {
        boxShadow:
            `0 ${variant === 'nav' ? 6 : 4}px ${lightBlur} ` +
            `rgba(24, 29, 21, ${lightAlpha}), inset 0 0 0 1px rgba(0, 0, 0, 0.05)`,
        ...theme.applyStyles('dark', {
            boxShadow:
                `0 ${variant === 'nav' ? 6 : 4}px ${darkBlur} rgba(0, 0, 0, 0.48), ` +
                `inset 0 0 0 1px rgba(255, 255, 255, ${darkBorderAlpha})`,
        }),
    };
}
