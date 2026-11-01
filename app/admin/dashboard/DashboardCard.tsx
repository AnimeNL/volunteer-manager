// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Card from '@mui/material/Card';
import { styled } from '@mui/material/styles';

/**
 * Props accepted by the <DashboardCard> component.
 */
interface DashboardCardProps {
    /**
     * Whether this card should be highlighted with a slightly different background color.
     */
    highlight?: boolean;

    /**
     * Whether this card should be highlighted with a warning background color.
     */
    warning?: boolean;
}

/**
 * Responsive variant of the <Card> component that removes outer margins in mobile display.
 */
export const DashboardCard = styled(Card, {
    shouldForwardProp: (prop) => prop !== 'highlight' && prop !== 'warning',
})<DashboardCardProps>(({ theme, highlight, warning }) => ({
    backgroundColor:
        !!warning ? theme.vars?.palette.backgroundWarning as any
                  : !!highlight ? theme.vars?.palette.backgroundHighlight as any
                                : undefined,
    display: 'flex',
    flexDirection: 'column',

    [theme.breakpoints.down('md')]: {
        '&:first-child': {
            borderRadius: 0,
            marginLeft: `${theme.spacing(-1)} !important`,
            marginRight: `${theme.spacing(-1)} !important`,
        },
    },
}));
