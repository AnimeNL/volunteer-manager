// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import React from 'react';

import Grid, { gridClasses } from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

/**
 * Props accepted by the <KeyValueList> component.
 */
interface KeyValueListProps {
    /**
     * Items to display in the list. Ordered.
     */
    items: {
        // TODO: condition
        // TODO: description

        /**
         * Key, i.e. the label, to display explaining what the value is.
         */
        key: string;

        /**
         * Value to display. May be a React component.
         */
        value: React.ReactNode;

        // TODO: valueTemplate

    }[];
}

/**
 * The <KeyValueList> component displays a list of labels together with values, which can be
 * components, in a consistent and responsive manner.
 */
export function KeyValueList(props: KeyValueListProps) {
    return (
        <KeyValueListGrid columns={24} container>
            { props.items.map(({ key, value }, index) =>
                <React.Fragment key={index}>
                    <Grid size={{ xs: 24, md: 7 }}>
                        <Typography variant="subtitle2" color="textSecondary">
                            {key}
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 24, md: 17 }}>
                        <Typography variant="body2">
                            {value}
                        </Typography>
                    </Grid>
                </React.Fragment> )}
        </KeyValueListGrid>
    );
}

/**
 * Styled variant of the <Grid> component with appropriate row padding and dividers.
 */
const KeyValueListGrid = styled(Grid)(({ theme }) => ({
    // Mobile styles:
    [theme.breakpoints.down('md')]: {
        [`& > .${gridClasses.root}:nth-child(2n)`]: {
            borderBottom: `1px solid ${theme.vars?.palette.divider}`,
            padding: theme.spacing(0.5, 0, 1, 0),
            margin: theme.spacing(0, 0, 0.5, 0),
        },
        [`& > .${gridClasses.root}:last-child`]: {
            borderBottom: 'none',
            paddingBottom: 0,
            marginBottom: 0,
        },
    },

    // Desktop styles:
    [theme.breakpoints.up('md')]: {
        [`& > .${gridClasses.root}`]: {
            borderBottom: `1px solid ${theme.vars?.palette.divider}`,
            padding: theme.spacing(0.5, 0),
        },

        [`& > .${gridClasses.root}:nth-last-child(-n+2)`]: {
            borderBottom: 'none',
        },
    },
}));
