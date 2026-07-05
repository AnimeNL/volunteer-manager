// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Suspense } from 'react';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { styled, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

/**
 * Props accepted by the <DashboardGrid>.
 */
interface DashboardGridProps {
    /**
     * The cards that should be displayed on the dashboard.
     */
    cards: React.ReactNode[];
}

/**
 * The <DashboardGrid> component composes the available cards, passed in the props, in the
 * appropriate number of columns for the user's display.
 */
export function DashboardGrid(props: DashboardGridProps) {
    const theme = useTheme();

    const isTabletSized = useMediaQuery(theme.breakpoints.up('md'));
    const isDesktopSized = useMediaQuery(theme.breakpoints.up('xl'));

    const columnsCount = isDesktopSized ? 4 : (isTabletSized ? 2 : 1);

    const columns: React.ReactNode[][] = Array.from({ length: columnsCount }, () => []);
    for (let index = 0; index < props.cards.length; ++index)
        columns[index % columnsCount].push(props.cards[index]);

    return (
        <DashboardGridContainer container spacing={1.5}>
            {columns.map((columnCards, colIndex) => (
                <Grid key={colIndex} size={{ xs: 12 / columnsCount }}>
                    <Stack spacing={1.5}>
                        {columnCards.map((card, cardIndex) => (
                            <Suspense key={cardIndex} fallback={null}>
                                {card}
                            </Suspense>
                        ))}
                    </Stack>
                </Grid>
            ))}
        </DashboardGridContainer>
    );
}

/**
 * Responsive variant of the <Grid> component that removes top margin on mobile displays.
 */
const DashboardGridContainer = styled(Grid)(({ theme }) => ({
    [`${theme.breakpoints.down('md')}`]: {
        marginTop: theme.spacing(-1),
    },
}));
