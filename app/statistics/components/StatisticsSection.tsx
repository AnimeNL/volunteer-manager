// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import StarIcon from '@mui/icons-material/Star';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { StatisticsDetails } from './StatisticsDetails';

/**
 * Props accepted by the <StatisticsSection> component when a "read more" button should be shown.
 */
type StatisticsSectionWithUrlProps = {
    /**
     * Search parameters that determine display filters.
     */
    searchParams: URLSearchParams;

    /**
     * Base URL that the "read more" button should link to.
     */
    url: string;
};

/**
 * Props accepted by the <StatisticsSection> component.
 */
type StatisticsSectionProps = {
    /**
     * Optional description of this metric that will be shown in an informative alert dialog.
     */
    description?: string;

    /**
     * Whether this section describes one of our Key Performance Indicators (KPIs).
     */
    kpi?: boolean;

    /**
     * Title of the graph, that will be prominently displayed.
     */
    title: string;

} & (StatisticsSectionWithUrlProps | { /* empty */ });

/**
 * The <StatisticsSection> component contains an individual statistic that, optionally, can be
 * further specialised by a deeper page in the tool.
 */
export function StatisticsSection(props: React.PropsWithChildren<StatisticsSectionProps>) {
    let moreDetailsLink: string | undefined;
    if ('url' in props) {
        moreDetailsLink =
            !!props.searchParams.size ? `${props.url}?${props.searchParams}`
                                      : props.url;
    }

    return (
        <Grid size={{ xs: 12, lg: 6 }}>
            <Paper component={Stack} elevation={2} sx={{ p: 2 }} spacing={1}>
                <Stack direction="row" alignItems="center" justifyContent="space-between"
                       spacing={2}>
                    <Typography variant="h6" noWrap>
                        {props.title}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        { !!props.kpi &&
                            <Tooltip title="Key Performance Indicator">
                                <StarIcon fontSize="small" htmlColor="#ffa000" />
                            </Tooltip> }
                        { !!props.description &&
                            <StatisticsDetails title={props.title}
                                               description={props.description} /> }
                    </Stack>
                </Stack>
                <Box>{props.children}</Box>
                { !!moreDetailsLink &&
                    <Stack alignItems="flex-end" sx={{ margin: '8px -8px -8px 0 !important' }}>
                        <Button component={Link} href={moreDetailsLink} color="primary">
                            More details
                        </Button>
                    </Stack> }
            </Paper>
        </Grid>
    );
}
