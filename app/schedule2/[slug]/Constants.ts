// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';

/**
 * Default primary palette colours for the schedule portal, independent of any host environment.
 */
export const kDefaultThemePalette = {
    dark: '#7986cb',
    light: '#303f9f',
};

/**
 * Maximum width, in pixels, the portal should use on desktop platforms. We use the `md` breakpoint
 * from MUI as the CSS media query, which equates 840px for the full viewport width.
 */
export const kDesktopMaximumWidthPx = 1280;

/**
 * Width, in pixels, the main menu should occupy on desktop platforms. This is a fixed size, and
 * will be applied no matter the width that will be taken by the content.
 */
export const kDesktopMenuWidthPx = 275;

/**
 * Style that enforces at most a single line of text with an ellipsis overflow.
 */
export const kEnforceSingleLine: SxProps<Theme> = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};
