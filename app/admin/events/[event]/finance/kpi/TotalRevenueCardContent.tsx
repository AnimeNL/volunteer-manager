// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import EuroIcon from '@mui/icons-material/Euro';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { formatDifference, formatMetric, formatMetricReference } from './ValueFormatter';

/**
 * Props accepted by the <TotalRevenueCardContent> component.
 */
interface TotalRevenueCardContentProps {
    /**
     * Headline metric that's most relevant for total revenue.
     */
    headline: {
        /**
         * The figure, rounded, to highlight. Will be formatted.
         */
        figure: number;

        /**
         * Change percentage or value from the previous period.
         */
        changePercentage?: number;
    };

    /**
     * Historical data that should be included for comparative reasons.
     */
    historical: {
        /**
         * Label of the comparison that's being made.
         */
        label: string;

        /**
         * Figure that applied at that point in time.
         */
        figure: number;
    }[];

    /**
     * Number of days remaining until the event will take place, to contextualise historical data.
     */
    remainingDays: number;
}

/**
 * The <TotalRevenueCardContent> component renders the client-side UI for <TotalRevenueCard>,
 * ensuring MUI <Tooltip> elements hydrate consistently with SSR.
 */
export function TotalRevenueCardContent(props: TotalRevenueCardContentProps) {
    const { headline, historical, remainingDays } = props;

    const changePercentage =
        headline.changePercentage !== undefined
            ? Math.round(headline.changePercentage)
            : undefined;

    return (
        <Paper sx={{ px: 2, py: 1 }}>
            <Stack direction="column" spacing={1}>
                <Stack direction="row" sx={{
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                        <EuroIcon fontSize="small" />
                        <Typography variant="h6" noWrap>
                            Total revenue
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography variant="h6">
                            { formatMetric(headline.figure, 'revenue') }
                        </Typography>
                        { changePercentage !== undefined &&
                            <Tooltip title="Compared to the previous 7-day period">
                                <Chip size="small"
                                      color={ changePercentage >= 0 ? 'success' : 'error' }
                                      label={
                                          changePercentage > 0
                                              ? `+${changePercentage}% w/w`
                                              : `${changePercentage}% w/w`
                                      } />
                            </Tooltip> }
                    </Stack>
                </Stack>
                { historical.length > 0 &&
                    <>
                        <Divider />
                        <List dense disablePadding>
                            { historical.map((entry, index) =>
                                <ListItem disableGutters disablePadding key={index}>
                                    <ListItemText primary={entry.label}
                                                  slotProps={{
                                                      primary: {
                                                          sx: { color: 'text.secondary' },
                                                      },
                                                  }} />
                                    <Tooltip title={
                                        formatMetricReference(
                                            entry.figure, 'revenue', remainingDays)
                                    }>
                                        <Typography
                                            color={
                                                entry.figure === headline.figure
                                                    ? 'textSecondary'
                                                    : entry.figure < headline.figure
                                                        ? 'success'
                                                        : 'error'
                                            }
                                            variant="body2">
                                            { formatDifference(headline.figure, entry.figure) }
                                        </Typography>
                                    </Tooltip>
                                </ListItem> )}
                        </List>
                    </> }
            </Stack>
        </Paper>
    );
}
