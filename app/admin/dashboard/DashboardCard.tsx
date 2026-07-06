// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Card from '@mui/material/Card';
import { styled } from '@mui/material/styles';

/**
 * Responsive variant of the <Card> component that removes outer margins in mobile display.
 */
export const DashboardCard = styled(Card)(({ theme }) => ({
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
