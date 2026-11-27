// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Default primary theme colour for the schedule portal when the `theme-color` setting is unset.
 */
export const kDefaultThemeColor = '#689f38';

/**
 * Default check-in cadence, in seconds, when `schedule-check-in-rate-seconds` is unset.
 */
export const kDefaultCheckInRateSeconds = /* five minutes= */ 5 * 60;

/**
 * Minimum allowed check-in cadence, in seconds, for automatic schedule refreshes.
 */
export const kMinCheckInRateSeconds = 5;

/**
 * Maximum allowed check-in cadence, in seconds, for automatic schedule refreshes.
 */
export const kMaxCheckInRateSeconds = 900;

/**
 * Width, in pixels, the main menu should occupy on desktop platforms. This is a fixed size, and
 * will be applied no matter the width that will be taken by the content.
 */
export const kDesktopMenuWidthPx = 236;

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

/**
 * Full-pill corner radius used by capsules, chips, badges, and rounded progress bars.
 */
export const kPillBorderRadius = 9999;
