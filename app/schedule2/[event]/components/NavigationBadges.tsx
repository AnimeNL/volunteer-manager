// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { styled } from '@mui/material/styles';

/**
 * Green activity indicator dot displayed when the signed-in volunteer has a currently active shift.
 */
export const ActivityDot = styled('span')(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        backgroundColor: palette.success.main,
        borderRadius: '50%',
        boxShadow: `0 0 0 3px color-mix(in srgb, ${palette.success.main} 25%, transparent)`,
        flexShrink: 0,
        height: 8,
        width: 8,
    };
});

/**
 * Pill counter badge supporting subtle (active events) and urgent (unread duty book / help
 * requests) tones. Shared across desktop sidebar navigation and the mobile More sheet.
 */
export const CounterBadge = styled('span', {
    shouldForwardProp: prop => prop !== 'tone',
})<{ tone?: 'subtle' | 'urgent' }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        alignItems: 'center',
        backgroundColor: `color-mix(in srgb, ${palette.text.primary} 10%, transparent)`,
        borderRadius: 9999,
        color: palette.text.secondary,
        display: 'inline-flex',
        flexShrink: 0,
        fontSize: '0.6875rem',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 600,
        height: 20,
        justifyContent: 'center',
        lineHeight: 1,
        minWidth: 20,
        paddingLeft: theme.spacing(0.75),
        paddingRight: theme.spacing(0.75),

        variants: [
            {
                props: { tone: 'urgent' },
                style: {
                    backgroundColor: palette.error.main,
                    color: palette.error.contrastText,
                },
            },
        ],
    };
});
