// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Default primary theme colour for the schedule portal when the `theme-color` setting is unset.
 */
export const kDefaultThemeColor = '#689f38';

/**
 * Maximum width, in pixels, the portal should use on desktop platforms. We use the `md` breakpoint
 * from MUI as the CSS media query, which equates 840px for the full viewport width.
 */
export const kDesktopMaximumWidthPx = 1280;

/**
 * Width, in pixels, the main menu should occupy on desktop platforms. This is a fixed size, and
 * will be applied no matter the width that will be taken by the content.
 */
export const kDesktopMenuWidthPx = 236;

/**
 * Unified structural spacing rhythm, in pixels, used between the outer shell, title dock, content
 * sheet, and cards (1.5 MUI spacing units at the 8px grid).
 */
export const kShellSpacingPx = 12;

/**
 * Outer content sheet corner radius, in pixels, optically concentric with the 12px inner cards.
 */
export const kSheetBorderRadiusPx = 18;

/**
 * Inner card and banner corner radius, in pixels.
 */
export const kCardBorderRadiusPx = 12;

/**
 * Height, in pixels, of the outer title/search pill dock and its paired circular account button.
 */
export const kHeaderBarHeightPx = 38;
