// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Formatter to display a number in a readable manner.
 */
const kNumberFormatter = new Intl.NumberFormat('en-GB', {
    style: 'decimal',
});

/**
 * Props accepted by the <MetricGridItem> component.
 */
interface MetricGridItemProps {
    /**
     * Title to display on the card.
     */
    title: string;

    /**
     * Data to display in the item.
     */
    data: { label: string; value: number }[];
}

/**
 * The <MetricGridItem> component displays a grid item for a particular metric, purely to display on
 * the tickets overview page for a quick impression on how it's going.
 */
export function MetricGridItem(props: MetricGridItemProps) {
    return (
        <Grid size={{ xs: 6, lg: 3 }}>
            <Paper sx={{ py: 1.5, px: 2 }}>
                <Typography variant="h6" sx={{ pb: 0.5 }}>
                    {props.title}
                </Typography>
                <Stack direction="column" spacing={.5} divider={ <Divider flexItem /> }>
                    { props.data.map(({ label, value }) =>
                        <Stack key={label} direction="row" spacing={1} sx={{
                            justifyContent: 'space-between',
                        }}>
                            <Typography variant="subtitle2">
                                {label}
                            </Typography>
                            <Typography variant="body2">
                                { kNumberFormatter.format(value) }
                            </Typography>
                        </Stack> )}
                </Stack>
            </Paper>
        </Grid>
    );
}
