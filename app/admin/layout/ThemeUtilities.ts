// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { hcl, rgb, type HCLColor } from 'd3-color';
import { interpolateNumber } from 'd3-interpolate';

/**
 * Hues that a color palette is expected to contain.
 * @see https://mui.com/material-ui/customization/color/#important-terms
 */
export type ColorHue =
    '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | '950';

/**
 * Palette is a collection of colours, hues and their shades.
 */
export type ColorPalette = { [k in ColorHue]: string };

/**
 * Computes the color palette for the given `themeColor`. This uses CIELCH-based rotations where
 * the lightness is adjusted based on the Material UI colour index (50, 100, ..., 900), with some
 * manual corrections when colours have yellows or brown.
 *
 * Credit for this implementation very much goes to Gemini.
 */
export function computePalette(themeColor: string): ColorPalette {
    const base = hcl(themeColor);

    const baseChroma = isNaN(base.c) ? 0 : base.c;
    const baseHue = isNaN(base.h) ? 0 : base.h;

    // 1. Differentiate High-Chroma Yellows from Low-Chroma Browns/Neutrals:
    const isHighChroma = baseChroma > 30;
    const isYellowOrWarm = baseHue >= 50 && baseHue <= 110 && isHighChroma;

    // 2. Define Lightness Floors:
    const darkLightnessFloor = isYellowOrWarm ? 38 : 12;
    const maxLightness = Math.min(97, Math.max(92, base.l + (100 - base.l) * 0.8));

    // 3. Build Monotonic Lightness Targets:
    const targetLightness: Record<number, number> = {};
    const lightSteps = [ 50, 100, 200, 300, 400 ];

    lightSteps.forEach((step, index) => {
        targetLightness[step] = interpolateNumber(maxLightness, base.l)(index / lightSteps.length);
    });

    targetLightness[500] = base.l;

    const darkSteps = [ 600, 700, 800, 900 ];
    darkSteps.forEach((step, index) => {
        targetLightness[step] =
            interpolateNumber(base.l, darkLightnessFloor)(index / (darkSteps.length + 1));
    });

    const steps = [ 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 ];
    const palette: Record<number, string> = {};

    for (const step of steps) {
        const L = targetLightness[step];

        // 4. Safe Hue Shifting
        let shiftedHue = baseHue;
        if (step > 500 && isYellowOrWarm) {
            const darkFactor = (step - 500) / 400; // 0 to 1
            if (isYellowOrWarm) {
                const targetHue = Math.max(35, baseHue - 35);
                shiftedHue = interpolateNumber(baseHue, targetHue)(darkFactor);

            } else if (isHighChroma && (baseHue < 40 || baseHue > 200)) {
                shiftedHue = (baseHue + 12 * darkFactor) % 360;
            }

            // Low chroma colors (browns/grays) keep shiftedHue == baseHue!
        }

        // 5. Chroma Scaling
        let targetChroma;
        if (step <= 500) {
            const minChromaFloor = Math.max(6, baseChroma * 0.25);
            const chromaFactor = (100 - L) / (100 - base.l);
            const scaledChroma = baseChroma * Math.max(0, chromaFactor) ** 0.55;
            targetChroma = Math.max(minChromaFloor, scaledChroma);

        } else {
            targetChroma = getMaxValidChroma(shiftedHue, L, baseChroma);
        }

        palette[step] = hcl((shiftedHue + 360) % 360, targetChroma, L).formatHex();
    }

    return palette as ColorPalette;
}


/**
 * Searches for maximum displayable chroma inside sRGB bounds
 */
function getMaxValidChroma(hue: number, lightness: number, baseChroma: number) {
    let low = 0;
    let high = Math.max(baseChroma * 1.4, 120);
    let bestChroma = 0;

    for (let i = 0; i < 8; i++) {
        const mid = (low + high) / 2;
        if (isInSRGB(hcl(hue, mid, lightness))) {
            bestChroma = mid;
            low = mid;
        } else {
            high = mid;
        }
    }

    return Math.min(bestChroma, Math.max(baseChroma, baseChroma * 1.1));
}

/**
 * Calculates whether the given `hclColor` can be expressed in RGB.
 */
function isInSRGB(hclColor: HCLColor) {
    const color = rgb(hclColor);
    const eps = 0.5;
    return (
        color.r >= -eps && color.r <= 255 + eps &&
        color.g >= -eps && color.g <= 255 + eps &&
        color.b >= -eps && color.b <= 255 + eps
    );
}
