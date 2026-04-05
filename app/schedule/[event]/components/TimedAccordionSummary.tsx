// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useMemo } from 'react';

import AccordionSummary, { accordionSummaryClasses } from '@mui/material/AccordionSummary';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Temporal, formatDate } from '@lib/Temporal';
import { kEnforceSingleLine } from '../Constants';

/**
 * Props accepted by the <TimedAccordionSummary> component.
 */
interface TimedAccordionSummaryProps {
    /**
     * Date, in a Temporal ZonedDateTime-compatible serialisation, that describes this entry.
     */
    date: string;

    /**
     * Optional string that defines how the 
     * @default "ddd, HH:mm"
     */
    dateFormat?: string;

    /**
     * Optional width of the date (& time) column, in pixels.
     * @default 88
     */
    dateWidth?: number;

    /**
     * Icon to display that allows the user to expand this accordion section.
     * @default <ExpandMoreIcon />
     */
    expandIcon?: React.ReactNode;

    /**
     * Icon to display between the summary and the date, if any.
     */
    icon?: React.ReactNode;

    /**
     * Summary that should be displayed on this element. Will overflow by displaying ellipsis.
     */
    summary: string;

    /**
     * Timezone in which the summary should be displayed.
     * @default `Temporal.Now.timeZoneId()`
     */
    timezone?: string;
}

/**
 * Component that displays the summary for an accordion entry with a non-overflowing text on the
 * left-hand side, followed by one or more icons, then a date and time in a local timezone.
 */
export function TimedAccordionSummary(props: TimedAccordionSummaryProps) {
    const formattedDate = useMemo(() => {
        const zonedDateTime = Temporal.ZonedDateTime.from(props.date);
        const localZonedDateTime =
            zonedDateTime.withTimeZone(props.timezone ?? Temporal.Now.timeZoneId());

        return formatDate(localZonedDateTime, props.dateFormat ?? 'ddd, HH:mm');

    }, [ props.date, props.dateFormat, props.timezone ]);

    return (
        <AccordionSummary expandIcon={ props.expandIcon ?? <ExpandMoreIcon /> }
                          sx={{
                              [`& .${accordionSummaryClasses.content}`]: {
                                  width: 'calc(100% - 32px)',
                              },
                              justifyContent: 'flex-start',
                          }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
                <Typography variant="body2" sx={{
                    ...kEnforceSingleLine,
                    pr: !!props.icon ? 2 : 0,
                }}>
                    {props.summary}
                </Typography>
                <Stack direction="row" alignItems="center" sx={{ ml: 'auto !important', pr: 1 }}>
                    {props.icon}
                    <Typography variant="body2"
                                sx={{
                                    width: `${props.dateWidth ?? 88}px`,
                                    textAlign: 'right'
                                }}>
                        {formattedDate}
                    </Typography>
                </Stack>
            </Stack>
        </AccordionSummary>
    );
}
