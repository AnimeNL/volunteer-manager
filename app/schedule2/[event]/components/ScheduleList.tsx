// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';

export { ScheduleListRow } from './ScheduleListRow';

/**
 * Props accepted by the <ScheduleList> component.
 */
interface ScheduleListProps {
    /**
     * Whether to render a recessed, muted container for past or finished groups (applies to the
     * `'conjoined'` variant).
     */
    muted?: boolean;

    /**
     * Layout presentation: `'conjoined'` (default) groups rows inside a single rounded card with
     * hairline dividers, while `'segmented'` stacks individual rounded tiles with a 3px gap.
     */
    variant?: 'conjoined' | 'segmented';
}

/**
 * Shared dense list container for the schedule portal. Supports conjoined cards for grouped events
 * and M3 Expressive segmented stacks for top-level entity indexes.
 */
export function ScheduleList(props: React.PropsWithChildren<ScheduleListProps>) {
    const { children, muted = false, variant = 'conjoined' } = props;

    if (variant === 'segmented')
        return <SegmentedListRoot spacing={0.375}>{children}</SegmentedListRoot>;

    return (
        <ConjoinedListRoot muted={muted}>
            {children}
        </ConjoinedListRoot>
    );
}

/**
 * Conjoined rounded card container with state-aware hairline dividers between child rows.
 */
const ConjoinedListRoot = styled(Box, {
    shouldForwardProp: prop => prop !== 'muted',
})<{ muted: boolean }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        backgroundColor: palette.background.paper,
        borderRadius: theme.shape.borderRadius,
        overflow: 'hidden',

        '& > :not(:first-of-type)': {
            borderTop: `1px solid color-mix(in srgb, ${palette.divider} 65%, transparent)`,
        },

        '& > [data-state="active"] + [data-state="active"]': {
            borderTop:
                `1px solid color-mix(in srgb, ${palette.secondary.contrastText} 12%, transparent)`,
        },

        '& > :not([data-state="active"]) + [data-state="active"]': {
            borderTop: 'none',
        },

        variants: [
            {
                props: { muted: true },
                style: {
                    backgroundColor:
                        `color-mix(in srgb, ${palette.text.primary} 2.5%, transparent)`,
                    border: `1px solid ${palette.divider}`,
                },
            },
        ],
    };
});

/**
 * M3 Expressive segmented stack applying 12px outer corners and 4px inner corners to child rows.
 */
const SegmentedListRoot = styled(Stack)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        '& > [data-state]': {
            backgroundColor: palette.background.paper,
            borderRadius: 4,
            overflow: 'hidden',
        },

        '& > [data-state]:first-of-type': {
            borderTopLeftRadius: theme.shape.borderRadius,
            borderTopRightRadius: theme.shape.borderRadius,
        },

        '& > [data-state]:last-of-type': {
            borderBottomLeftRadius: theme.shape.borderRadius,
            borderBottomRightRadius: theme.shape.borderRadius,
        },

        '& > a[data-state="default"]:hover': {
            backgroundColor:
                `color-mix(in srgb, ${palette.background.paper} 94%, ${palette.text.primary})`,
        },
    };
});

