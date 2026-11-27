// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { hcl } from 'd3-color';

/**
 * Tonal surface and foreground tokens for an analogous overview action tile.
 */
interface M3ActionTileTone {
    background: string;
    icon: string;
    iconBackground: string;
    text: string;
}

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
     * Elevated background for the mobile floating bottom navigation pill.
     */
    floatingNav: string;

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

    /**
     * Primary stop for the top-of-viewport ambient gradient (lightens in dark, darkens in light).
     */
    ambientGlow: string;

    /**
     * Mid-fade stop for the top-of-viewport ambient gradient.
     */
    ambientGlowSoft: string;

    /**
     * Analogous tonal palettes shifted in HCL hue space from the seed colour for overview action
     * tiles (seafoam, sage, warm honey, and sky when seeded with green).
     */
    tileAccentA: M3ActionTileTone;
    tileAccentB: M3ActionTileTone;
    tileAccentC: M3ActionTileTone;
    tileAccentD: M3ActionTileTone;
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
 * Converts an HCL triplet and opacity into a clamped CSS `rgba(...)` colour string.
 */
function hclToRgba(hue: number, chroma: number, luminance: number, alpha: number): string {
    const rgb = hcl(hue, chroma, luminance).rgb().clamp();
    return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${alpha})`;
}

/**
 * Computes a light or dark analogous action tile tone by rotating the seed `hue` in HCL space.
 */
function computeTileTone(
    hue: number, chroma: number, dark: boolean): M3ActionTileTone
{
    if (dark) {
        return {
            background: hclToHex(hue, chroma * 0.9, 27),
            icon: hclToHex(hue, chroma * 1.1, 86),
            iconBackground: hclToHex(hue, chroma * 1.05, 36),
            text: hclToHex(hue, chroma * 0.7, 92),
        };
    }

    return {
        background: hclToHex(hue, chroma * 0.95, 86),
        icon: hclToHex(hue, chroma * 1.3, 32),
        iconBackground: hclToHex(hue, chroma * 1.15, 77),
        text: hclToHex(hue, chroma * 1.0, 20),
    };
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
    const tileChroma = isAchromatic ? 0 : Math.min(Math.max(baseChroma * 0.65, 30), 42);

    const dark: M3TonalPalette = {
        shell: hclToHex(hue, neutralChroma, 12.5),
        sheet: hclToHex(hue, neutralChroma, 7),
        dock: hclToHex(hue, neutralChroma * 1.15, 24),
        dockActive: hclToHex(hue, neutralChroma * 1.15, 28),
        card: hclToHex(hue, neutralChroma, 17),
        floatingNav: hclToHex(hue, neutralChroma, 16.5),
        primary: hclToHex(hue, primaryChroma * 0.74, 72),
        onPrimary: hclToHex(hue, primaryChroma * 0.65, 16),
        secondaryContainer: hclToHex(hue, secondaryChroma * 1.05, 32),
        onSecondaryContainer: hclToHex(hue, secondaryChroma * 0.85, 90),
        onSurface: hclToHex(hue, neutralChroma * 0.7, 91),
        onSurfaceVariant: hclToHex(hue, neutralVariantChroma, 71),
        treeLine: hclToHex(hue, secondaryChroma * 0.85, 38),
        outlineVariant: hclToHex(hue, neutralVariantChroma, 28),
        ambientGlow: hclToRgba(hue, secondaryChroma * 0.85, 48, 0.2),
        ambientGlowSoft: hclToRgba(hue, secondaryChroma * 0.65, 34, 0.08),
        tileAccentA: computeTileTone(hue + 50, tileChroma, /* dark= */ true),
        tileAccentB: computeTileTone(hue - 18, tileChroma, /* dark= */ true),
        tileAccentC: computeTileTone(hue - 55, tileChroma, /* dark= */ true),
        tileAccentD: computeTileTone(hue + 100, tileChroma, /* dark= */ true),
    };

    const light: M3TonalPalette = {
        shell: hclToHex(hue, neutralChroma * 1.15, 95.5),
        sheet: '#ffffff',
        dock: '#ffffff',
        dockActive: '#ffffff',
        card: hclToHex(hue, neutralChroma * 1.15, 95.5),
        floatingNav: hclToHex(hue, neutralChroma * 1.25, 93),
        primary: hclToHex(hue, primaryChroma * 0.85, 42),
        onPrimary: '#ffffff',
        secondaryContainer: hclToHex(hue, secondaryChroma * 1.1, 84),
        onSecondaryContainer: hclToHex(hue, secondaryChroma * 0.9, 21),
        onSurface: hclToHex(hue, neutralChroma, 11),
        onSurfaceVariant: hclToHex(hue, neutralVariantChroma, 38),
        treeLine: hclToHex(hue, secondaryChroma * 0.85, 79),
        outlineVariant: hclToHex(hue, neutralVariantChroma, 84),
        ambientGlow: hclToRgba(hue, secondaryChroma * 0.85, 58, 0.14),
        ambientGlowSoft: hclToRgba(hue, secondaryChroma * 0.65, 70, 0.06),
        tileAccentA: computeTileTone(hue + 50, tileChroma, /* dark= */ false),
        tileAccentB: computeTileTone(hue - 18, tileChroma, /* dark= */ false),
        tileAccentC: computeTileTone(hue - 55, tileChroma, /* dark= */ false),
        tileAccentD: computeTileTone(hue + 100, tileChroma, /* dark= */ false),
    };

    return { dark, light };
}
