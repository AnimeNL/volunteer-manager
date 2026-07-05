// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Suspense } from 'react';

import Grid from '@mui/material/Grid';
import { styled } from '@mui/material/styles';

/**
 * Information required for each of the cards that should be shown on the dashboard.
 */
export interface DashboardCardInfo {
    /**
     * The element that should be shown as the card's content.
     */
    element: React.ReactNode;
}

/**
 * Props accepted by the <DashboardGrid>.
 */
interface DashboardGridProps {
    /**
     * The cards that should be displayed on the dashboard.
     */
    cards: DashboardCardInfo[];
}

/**
 * The <DashboardGrid> component composes the available cards, passed in the props, in the
 * appropriate number of columns for the user's display.
 */
export function DashboardGrid(props: DashboardGridProps) {
    // TODO: Support multiple columns
    // TODO: Support loading elements

    return (
        <DashboardGridContainer container>
            { props.cards.map((card, index) =>
                <Grid key={index} size={{ xs: 12 }}>
                    <Suspense fallback={null}>
                        {card.element}
                    </Suspense>
                </Grid> ) }
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
