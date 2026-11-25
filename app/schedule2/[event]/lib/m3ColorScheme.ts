// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { hcl } from 'd3-color';

/**
 * Material Design 3 tonal surface and container tokens derived from a single seed colour.
 */
export interface M3TonalPalette {
    /**
     * Outer app chrome background (`surface-container` in dark, `surface-container-low` in light).
     */
    shell: string;

    /**
     * Primary rounded content sheet surface (`surface` in dark, `surface-container-lowest` in light).
     */
    sheet: string;

    /**
     * Resting outer title/search pill dock background.
     */
    dock: string;

    /**
     * Active/elevated search pill dock background.
     */
    dockActive: string;

    /**
     * Standard card surface inside the content sheet.
     */
    card: string;

    /**
     * Subtle elevated container for icon circles and secondary tonal buttons inside cards.
     */
    cardElevated: string;

    /**
     * Elevated background for the mobile floating bottom navigation pill.
     */
    floatingNav: string;

    /**
     * Expressive primary container fill (e.g. focal hero status cards).
     */
    primaryContainer: string;

    /**
     * High-contrast text/icon colour on `primaryContainer`.
     */
    onPrimaryContainer: string;

    /**
     * Primary accent fill (e.g. expressive badge on hero cards, primary buttons).
     */
    primary: string;

    /**
     * High-contrast text/icon colour on `primary`.
     */
    onPrimary: string;

    /**
     * Secondary tonal container fill (active navigation pills, circular account button).
     */
    secondaryContainer: string;

    /**
     * High-contrast text/icon colour on `secondaryContainer`.
     */
    onSecondaryContainer: string;

    /**
     * Primary foreground text colour on tonal surfaces.
     */
    onSurface: string;

    /**
     * Secondary/muted foreground text and icon colour on tonal surfaces.
     */
    onSurfaceVariant: string;

    /**
     * Subtle vertical guide line colour for nested sidebar navigation trees.
     */
    treeLine: string;

    /**
     * Subtle divider/outline colour harmonised with the seed hue.
     */
    outlineVariant: string;
}

/**
 * Complete light and dark Material Design 3 palettes computed from one seed colour.
 */
export interface M3ColorScheme {
    dark: M3TonalPalette;
    light: M3TonalPalette;
}

/**
 * Converts an HCL triplet (perceptual Hue, Chroma, Luminance) into a clamped 6-digit RGB hex string.
 */
function hclToHex(hue: number, chroma: number, luminance: number): string {
    return hcl(hue, chroma, luminance).rgb().clamp().formatHex();
}

/**
 * Computes cohesive Light and Dark Material Design 3 tonal palettes from a single hex seed colour
 * (for example `#689f38`). Uses perceptual HCL space to generate tinted neutrals, secondary
 * navigation pills, and expressive primary containers without external color-utility bloat.
 */
export function computeM3ColorScheme(seedColor: string): M3ColorScheme {
    const parsed = hcl(seedColor);
    const isAchromatic = !Number.isFinite(parsed.h) || !Number.isFinite(parsed.c) || parsed.c < 2;

    const hue = isAchromatic ? 0 : parsed.h;
    const baseChroma = isAchromatic ? 0 : parsed.c;

    // Tonal chroma tiers modeled on Material Design 3's Neutral / Neutral-Variant / Secondary /
    // Primary key roles:
    const neutralChroma = isAchromatic ? 0 : Math.min(baseChroma * 0.14, 7);
    const neutralVariantChroma = isAchromatic ? 0 : Math.min(baseChroma * 0.22, 11);
    const secondaryChroma = isAchromatic ? 0 : Math.min(baseChroma * 0.38, 22);
    const primaryChroma = isAchromatic ? 0 : Math.min(Math.max(baseChroma * 0.9, 36), 60);

    const dark: M3TonalPalette = {
        shell: hclToHex(hue, neutralChroma, 12.5),
        sheet: hclToHex(hue, neutralChroma, 7),
        dock: hclToHex(hue, neutralChroma, 17),
        dockActive: hclToHex(hue, neutralChroma, 22.5),
        card: hclToHex(hue, neutralChroma, 17),
        cardElevated: hclToHex(hue, neutralChroma, 22.5),
        floatingNav: hclToHex(hue, neutralChroma, 16.5),
        primaryContainer: hclToHex(hue, primaryChroma * 0.72, 30),
        onPrimaryContainer: hclToHex(hue, primaryChroma * 0.55, 92),
        primary: hclToHex(hue, primaryChroma * 0.78, 80),
        onPrimary: hclToHex(hue, primaryChroma * 0.65, 19),
        secondaryContainer: hclToHex(hue, secondaryChroma, 29),
        onSecondaryContainer: hclToHex(hue, secondaryChroma * 0.85, 90),
        onSurface: hclToHex(hue, neutralChroma * 0.7, 91),
        onSurfaceVariant: hclToHex(hue, neutralVariantChroma, 71),
        treeLine: hclToHex(hue, secondaryChroma * 0.85, 38),
        outlineVariant: hclToHex(hue, neutralVariantChroma, 28),
    };

    const light: M3TonalPalette = {
        shell: hclToHex(hue, neutralChroma * 1.15, 95.5),
        sheet: '#ffffff',
        dock: '#ffffff',
        dockActive: '#ffffff',
        card: hclToHex(hue, neutralChroma * 1.15, 95.5),
        cardElevated: hclToHex(hue, secondaryChroma * 0.9, 91),
        floatingNav: hclToHex(hue, neutralChroma * 1.25, 93),
        primaryContainer: hclToHex(hue, primaryChroma * 0.72, 90),
        onPrimaryContainer: hclToHex(hue, primaryChroma * 0.65, 20),
        primary: hclToHex(hue, primaryChroma * 0.85, 42),
        onPrimary: '#ffffff',
        secondaryContainer: hclToHex(hue, secondaryChroma * 0.9, 91),
        onSecondaryContainer: hclToHex(hue, secondaryChroma * 0.9, 21),
        onSurface: hclToHex(hue, neutralChroma, 11),
        onSurfaceVariant: hclToHex(hue, neutralVariantChroma, 38),
        treeLine: hclToHex(hue, secondaryChroma * 0.85, 79),
        outlineVariant: hclToHex(hue, neutralVariantChroma, 84),
    };

    return { dark, light };
}
