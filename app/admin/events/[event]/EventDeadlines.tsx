// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';

import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import Chip, { type ChipProps } from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FlagIcon from '@mui/icons-material/Flag';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { PageInfo } from '../verifyAccessAndFetchPageInfo';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * Props accepted by the <EventDeadlines> component.
 */
interface EventDeadlinesProps {
    event: PageInfo['event'];

    /**
     * The pending deadlines that should be shown as being relevant for this event.
     */
    deadlines: {
        id: number;
        date: string;
        title: string;
        description: string;
        owner?: string;
    }[];
}

/**
 * The <EventDeadlines> component displays the deadlines that are still pending for this event, as
 * an accordion that can be expanded to reveal additional information.
 */
export function EventDeadlines(props: EventDeadlinesProps) {
    const currentDate = Temporal.Now.plainDateISO();

    return (
        <Card>
            <CardHeader avatar={ <FlagIcon color="primary" /> }
                        title={`${props.event.shortName} deadlines`}
                        slotProps={{ title: { variant: 'subtitle2' } }} />
            <Divider sx={{ visibility: 'hidden' }} />
            { props.deadlines.map(deadline => {
                const deadlineDate = Temporal.PlainDate.from(deadline.date);
                const difference = currentDate.until(deadlineDate, {
                    largestUnit: 'days',
                });

                let color: ChipProps['color'] = 'default';
                if (difference.days <= 0)
                    color = 'error';
                else if (difference.days <= 7)
                    color = 'warning';
                else if (difference.days <= 14)
                    color = 'info';

                return (
                    <Accordion key={deadline.id} disableGutters>
                        <AccordionSummary expandIcon={ <ExpandMoreIcon /> }>
                            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                                <Chip color={color} label={formatDate(deadlineDate, 'MMMM Do')}
                                      size="small" />
                                <Typography variant="body2">
                                    {deadline.title}
                                </Typography>
                            </Stack>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0 }}>
                            <Typography variant="body2">
                                {deadline.description}
                            </Typography>
                            { !!deadline.owner &&
                                <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                                    Assigned to {deadline.owner}
                                </Typography> }
                        </AccordionDetails>
                    </Accordion>
                );
            }) }
        </Card>
    );
}
