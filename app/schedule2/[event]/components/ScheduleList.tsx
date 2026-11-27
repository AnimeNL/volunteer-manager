// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { createContext, useContext } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';

import { mixColor, mutedRowSurface, subtleDividerBorder } from '../ScheduleTheme';

export { ScheduleListRow } from './ScheduleListRow';

/**
 * Layout variant shared from `<ScheduleList>` to its child `<ScheduleListRow>` items.
 */
type ScheduleListVariant = 'conjoined' | 'segmented';

const ScheduleListVariantContext = createContext<ScheduleListVariant>('conjoined');

/**
 * Returns the layout variant of the enclosing `<ScheduleList>`.
 */
export function useScheduleListVariant(): ScheduleListVariant {
    return useContext(ScheduleListVariantContext);
}

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
    variant?: ScheduleListVariant;
}

/**
 * Shared dense list container for the schedule portal. Supports conjoined cards for grouped events
 * and M3 Expressive segmented stacks for top-level entity indexes.
 */
export function ScheduleList(props: React.PropsWithChildren<ScheduleListProps>) {
    const { children, muted = false, variant = 'conjoined' } = props;

    return (
        <ScheduleListVariantContext.Provider value={variant}>
            { variant === 'segmented' ? (
                <SegmentedListRoot spacing={0.375}>
                    {children}
                </SegmentedListRoot>
            ) : (
                <ConjoinedListRoot muted={muted}>
                    {children}
                </ConjoinedListRoot>
            ) }
        </ScheduleListVariantContext.Provider>
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
            borderTop: subtleDividerBorder(theme),
        },

        '& > [data-active="true"] + [data-active="true"]': {
            borderTop: `1px solid ${mixColor(palette.secondary.contrastText, 12)}`,
        },

        '& > :not([data-active="true"]) + [data-active="true"]': {
            borderTop: 'none',
        },

        variants: [
            {
                props: { muted: true },
                style: {
                    backgroundColor: mutedRowSurface(theme),
                },
            },
        ],
    };
});

/**
 * M3 Expressive segmented stack applying 12px outer corners and 4px inner corners to child rows.
 */
const SegmentedListRoot = styled(Stack)(({ theme }) => ({
    '& > *': {
        backgroundColor: (theme.vars || theme).palette.background.paper,
        borderRadius: 4,
        overflow: 'hidden',
    },

    '& > :first-of-type': {
        borderTopLeftRadius: theme.shape.borderRadius,
        borderTopRightRadius: theme.shape.borderRadius,
    },

    '& > :last-of-type': {
        borderBottomLeftRadius: theme.shape.borderRadius,
        borderBottomRightRadius: theme.shape.borderRadius,
    },
}));
