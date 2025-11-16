// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { formatMetric } from './ValueFormatter';

/**
 * Formats the difference between the `figure` and the `reference` as a percentage.
 */
function formatDifference(figure: number, reference: number) {
    if (!reference) {
        if (!figure)
            return /* no data: */ '=';

        return /* no comparable results: */ '+100%';
    }

    const difference = (figure - reference) / reference;
    const differencePct = Math.round(difference * 100);

    return differencePct > 0 ? `+${differencePct}%`
                             : `${differencePct}%`;
}

/**
 * Props accepted by the <KeyMetricCard> component.
 */
interface KeyMetricCardProps {
    /**
     * Formatting rules that should be applied to the figures.
     */
    format: 'revenue' | 'sales';

    /**
     * Headline metric that's most relevant for this metric.
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
     * Historical data that should be included for comparitative reasons.
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

    /**
     * Optional subject that explains what the figure is, to be used in tooltips.
     */
    subject?: string;

    /**
     * Title of the metric that's being described.
     */
    title: string;
}

/**
 * The <KeyMetricCard> component displays a MUI Card representing one of the top-line metrics. While
 * content will be decided by the individual cards, their layout is consistent.
 */
export function KeyMetricCard(props: React.PropsWithChildren<KeyMetricCardProps>) {
    const { format, headline, historical, remainingDays, subject, title } = props;

    function formatMetricRef(figure: number) {
        const formattedMetric = formatMetric(figure, format, subject);
        if (remainingDays > 0)
            return `${formattedMetric} @ T-${remainingDays} days`;

        return formattedMetric;
    }

    return (
        <Card>
            <CardContent sx={{ paddingBottom: '8px !important' }}>
                <Typography sx={{ color: 'text.secondary', fontSize: 14, mb: -0.5 }}>
                    {title}
                </Typography>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6">
                        { formatMetric(headline.figure, format) }
                    </Typography>
                    { headline.changePercentage &&
                        <Tooltip title="Compared to the previous 7-day period">
                            <Chip size="small"
                                  color={ headline.changePercentage >= 0 ? 'success' : 'error' }
                                  label={
                                      headline.changePercentage > 0
                                          ? `+${headline.changePercentage}% w/w`
                                          : `${headline.changePercentage}% w/w`
                                  } />
                        </Tooltip> }
                </Stack>
                <Divider sx={{ mt: 1 }} />
                {props.children}
                <Divider sx={{ mb: 0.5 }} />
                <List dense disablePadding>
                    { historical.map((entry, index) =>
                        <ListItem disableGutters disablePadding key={index}>
                            <ListItemText primary={entry.label}
                                          slotProps={{
                                              primary: {
                                                  sx: { color: 'text.secondary'}
                                              }
                                          }} />
                            <Tooltip title={ formatMetricRef(entry.figure) }>
                                <Typography
                                    color={ entry.figure < headline.figure ? 'success' : 'error' }
                                    variant="body2">
                                    { formatDifference(headline.figure, entry.figure) }
                                </Typography>
                            </Tooltip>
                        </ListItem> )}
                </List>
                { /* TODO: Provide access to a multi-year comparison */ }
                { /* TODO: Provide access to AI-driven insights */ }
            </CardContent>
        </Card>
    );
}
