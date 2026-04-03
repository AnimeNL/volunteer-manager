// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useContext, useState } from 'react';

import Accordion from '@mui/material/Accordion';
import AccordionSummary, { accordionSummaryClasses } from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import AlertTitle from '@mui/material/AlertTitle';
import BookIcon from '@mui/icons-material/Book';
import Box from '@mui/material/Box';
import CardHeader from '@mui/material/CardHeader';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import IconButton from '@mui/material/IconButton';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import Stack from '@mui/material/Stack';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { Alert } from '../components/Alert';
import { HeaderSectionCard } from '../components/HeaderSectionCard';
import { ReportIncidentDialog } from './ReportIncidentDialog';
import { ScheduleContext } from '../ScheduleContext';
import { SetTitle } from '../components/SetTitle';
import { Temporal, formatDate } from '@lib/Temporal';

import { kEnforceSingleLine } from '../Constants';

/**
 * Local cache storing which incidents have already been read, and don't have to be updated to the
 * server to maintain state.
 */
const kReadIncidentCache = new Set<number>;

/**
 * Props accepted by the <DutyBookPage> component.
 */
export interface DutyBookPageProps {
    /**
     * The incidents that have been reported this year.
     */
    incidents: {
        // TODO: Attachments

        /**
         * Unique ID of this incident as it exists in the database.
         */
        id: number;

        /**
         * Name of the person who added this duty book entry.
         */
        author: string;

        /**
         * Date at which the incident was reported, in a Temporal ZonedDateTime-compatible format.
         */
        date: string;

        /**
         * Whether the signed in user has already read this incident.
         */
        read: boolean;

        /**
         * Summary that describes the incident.
         */
        summary: string;

        /**
         * Text associated with the incident. This may be omitted when it's been censored.
         */
        text?: string;

    }[];

    /**
     * Timezone in which the event is taking place.
     */
    timezone: string;
}

/**
 * Component that renders an individual summary entry for a duty book entry. It's formatted to be
 * dense with information, and immediately signal to the user whether they've seen it before.
 */
function DutyBookEntrySummary(props: {
    incident: DutyBookPageProps['incidents'][number];
    timezone: string;
}) {
    const { incident, timezone } = props;

    const date = Temporal.ZonedDateTime.from(incident.date);
    const read = incident.read || kReadIncidentCache.has(incident.id);

    return (
        <AccordionSummary expandIcon={
                              !!incident.text ? <ExpandMoreIcon />
                                              : <CloseIcon color="disabled" /> }
                          sx={{ pr: 3 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
                <Typography variant="body2" sx={{
                    ...kEnforceSingleLine,
                    pr: 2,
                }}>
                    {incident.summary}
                </Typography>
                <Stack direction="row" alignItems="center" sx={{ ml: 'auto !important', pr: 1 }}>

                    { !read &&
                        <Tooltip title="This incident is new to you">
                            <NewReleasesIcon color="error" fontSize="small" />
                        </Tooltip> }
                    { !!read &&
                        <Tooltip title="You've read this incident">
                            <TaskAltIcon color="success" fontSize="small" />
                        </Tooltip> }

                    <Typography variant="body2" sx={{ width: '88px', textAlign: 'right' }}>
                        { formatDate(date.withTimeZone(timezone), 'ddd, HH:mm') }
                    </Typography>
                </Stack>
            </Stack>
        </AccordionSummary>
    );
}

/**
 * The <DutyBookPage> component is the client-side component that provides the Duty Book UI, which
 * is complemented with data provided from the server component.
 */
export function DutyBookPage(props: DutyBookPageProps) {
    const { refresh, schedule } = useContext(ScheduleContext);

    // ---------------------------------------------------------------------------------------------

    const [ reportIncidentDialogOpen, setReportIncidentDialogOpen ] = useState<boolean>(false);

    const closeReportIncidentDialog = useCallback(() => setReportIncidentDialogOpen(false), []);
    const openReportIncidentDialog = useCallback(() => setReportIncidentDialogOpen(true), []);

    const handleIncidentToggle = useCallback(async (incidentId: number) => {
        if (kReadIncidentCache.has(incidentId))
            return;  // already reported

        // TODO: Report

        kReadIncidentCache.add(incidentId);

    }, [ /* no deps */ ]);

    const handleIncidentSubmission = useCallback(async (incident: string) => {
        // TODO: Submit
        // TODO: Refresh

        return true;

    }, [ /* no deps */ ]);

    // ---------------------------------------------------------------------------------------------

    if (!schedule)
        return undefined;  // the page is still loading

    return (
        <>
            <SetTitle title="Duty book" />
            <HeaderSectionCard>
                <CardHeader title="Duty book"
                            subheader={schedule.event}
                            slotProps={{ title: { variant: 'subtitle2' } }}
                            sx={{ '& .MuiCardHeader-action': { alignSelf: 'center' },
                                  '& .MuiCardHeader-content': kEnforceSingleLine,
                                  '& .MuiCardHeader-content>:first-child': { display: 'inline' } }}
                            action={
                                <Tooltip title="Report an incident">
                                    <IconButton onClick={openReportIncidentDialog} sx={{ mr: 1 }}>
                                        <AddCircleIcon color="primary" />
                                    </IconButton>
                                </Tooltip>
                            }
                            avatar={
                                <BookIcon />
                            } />
            </HeaderSectionCard>

            { !props.incidents.length &&
                <Alert elevation={1} severity="info">
                    <AlertTitle>No incidents have been reported yet</AlertTitle>
                    Perhaps everything is actually going according to plan this year?
                </Alert> }

            { !!props.incidents.length &&
                <Box>
                    { props.incidents.map(incident => {
                        if (incident.read)
                            kReadIncidentCache.add(incident.id);

                        return (
                            <Accordion key={incident.date}
                                    onChange={handleIncidentToggle.bind(null, incident.id)}
                                    sx={{
                                        [`& .${accordionSummaryClasses.content}`]: {
                                            width: '100%',
                                            paddingLeft: 1.5,
                                        },
                            }}>
                                <DutyBookEntrySummary incident={incident} timezone={props.timezone} />
                                <AccordionDetails sx={{ pt: 0 }}>
                                    { !incident.text &&
                                        <Typography variant="body2" sx={{ fontStyle: 'italic' }}
                                                    color="textDisabled">
                                            The details of this incident have been hidden.
                                        </Typography> }
                                    { !!incident.text &&
                                        <Typography variant="body2">
                                            "<Typography variant="inherit" component="span"
                                                         sx={{ fontStyle: 'italic' }}>
                                                {incident.text}
                                            </Typography>" — {incident.author}
                                        </Typography> }
                                </AccordionDetails>
                            </Accordion>
                        );
                    }) }
                </Box> }

            { reportIncidentDialogOpen &&
                <ReportIncidentDialog onClose={closeReportIncidentDialog}
                                      onSubmit={handleIncidentSubmission}/> }
        </>
    );
}
