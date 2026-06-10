// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';

/**
 * Wrapper component that surrounds the page's content.
 */
export const AdminContentWrapper = styled('div')(() => ({
    flex: 1,
}));

/**
 * Wrapper component that surrounds the entire page. Is a flex container, to allow child components
 * to be dynamically positioned on large screen devices.
 *
 * The first two elements are the navigation sirebar and the navigation menu, which we give a sticky
 * position so that they remain in a consistent position on the screen regardless of scrolling.
 */
export const AdminPageWrapper = styled(Stack)(({ theme }) => ({
    backgroundColor: theme.vars?.palette.background.default,
    minHeight: '100dvh',
    padding: theme.spacing(1),

    '& > :nth-child(-n + 2)': {
        position: 'sticky',
        top: '8px',
        height: 'calc(100dvh - 16px)',
    },
}));
