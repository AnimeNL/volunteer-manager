// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';

/**
 * Wrapper component that surrounds the page's content. Will avoid growing the page's overall height
 * and instead become a scroll container itself, when necessary.
 */
export const AdminContentWrapper = styled('div')(({ theme }) => ({
    flex: 1,

    // TODO: Figure out the scroll container stuff (negative margin + padding + 100dvh max height?)
    // TODO: Figure out how to scroll this element no matter where the scroll wheel is used
}));

/**
 * Wrapper component that surrounds the entire page. Is a flex container, to allow child components
 * to be dynamically positioned on large screen devices.
 */
export const AdminPageWrapper = styled(Stack)(({ theme }) => ({
    backgroundColor: theme.vars?.palette.background.default,
    minHeight: '100dvh',
    padding: theme.spacing(1),
}));
