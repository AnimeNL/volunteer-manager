// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { useCallback, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AlertTitle from '@mui/material/AlertTitle';
import BookIcon from '@mui/icons-material/Book';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CardHeader from '@mui/material/CardHeader';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FlagIcon from '@mui/icons-material/Flag';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { Alert } from '../components/Alert';
import { HeaderSectionCard } from '../components/HeaderSectionCard';
import { ReportIncidentDialog } from './ReportIncidentDialog';
import { ScheduleContext } from '../ScheduleContext';
import { SetTitle } from '../components/SetTitle';
import { TimedAccordionSummary } from '../components/TimedAccordionSummary';
import { callApi } from '@lib/callApi';

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
         * User ID of the author of this entry, in case we can link through to their profile.
         */
        authorUserId: number;

        /**
         * Date at which the incident was reported, in a Temporal ZonedDateTime-compatible format.
         */
        date: string;

        /**
         * Whether the entry has been hidden from regular users.
         */
        hidden: boolean;

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
 * The <DutyBookPage> component is the client-side component that provides the Duty Book UI, which
 * is complemented with data provided from the server component.
 */
export function DutyBookPage(props: DutyBookPageProps) {
    const router = useRouter();
    const { schedule } = useContext(ScheduleContext);

    // ---------------------------------------------------------------------------------------------

    const [ openedIncidentSet, setOpenedIncidentSet ] = useState<Set<number>>(kReadIncidentCache);
    const [ reportIncidentDialogOpen, setReportIncidentDialogOpen ] = useState<boolean>(false);

    const closeReportIncidentDialog = useCallback(() => setReportIncidentDialogOpen(false), []);
    const openReportIncidentDialog = useCallback(() => setReportIncidentDialogOpen(true), []);

    const handleIncidentToggle = useCallback(async (incidentId: number) => {
        if (kReadIncidentCache.has(incidentId))
            return;  // already reported

        try {
            const response = await callApi('put', '/api/event/schedule/duty-book', {
                id: incidentId,
            });

            if (!response || !response.success)
                throw new Error('The API returned an invalid response');

        } catch (error) {
            console.error('Unable to record the duty book access', error);
        }

        kReadIncidentCache.add(incidentId);
        setOpenedIncidentSet(new Set([ ...kReadIncidentCache ]));  // cause an invalidation

    }, [ /* no deps */ ]);

    const handleIncidentSubmission = useCallback(async (incident: string) => {
        if (!schedule)
            return false;  // unable to report incidents before the schedule is loaded

        const response = await callApi('post', '/api/event/schedule/duty-book', {
            event: schedule.slug,
            incident,
        });

        if (!response.success)
            throw new Error(response.error || 'Unable to save the incident in the database');

        router.refresh();  // ensure the incident is displayed

        return true;

    }, [ router, schedule ]);

    // ---------------------------------------------------------------------------------------------

    if (!schedule)
        return undefined;  // the page is still loading

    return (
        <>
            <SetTitle title="Duty book" />
            <HeaderSectionCard>
                <CardHeader title="Duty book"
                            subheader={
                                'Whether it\'s a minor mishap, a safety concern, or an official ' +
                                'reportable incident, your detailed accounts are vital to the ' +
                                'festival\'s security and success—as is your awareness of the ' +
                                'incidents reported by other volunteers.'
                            }
                            slotProps={{ title: { variant: 'subtitle2' } }}
                            avatar={
                                <BookIcon />
                            } />
            </HeaderSectionCard>

            <Button fullWidth startIcon={ <FlagIcon /> } variant="contained" color="primary"
                    onClick={openReportIncidentDialog}>
                Report an incident
            </Button>

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

                        const read =
                            openedIncidentSet.has(incident.id) ||
                            kReadIncidentCache.has(incident.id);

                        const authorUserId = `${incident.authorUserId}`;
                        const canAccessAuthorProfile =
                            schedule.volunteers.hasOwnProperty(authorUserId);

                        return (
                            <Accordion key={incident.id}
                                       onChange={handleIncidentToggle.bind(null, incident.id)}>

                                <TimedAccordionSummary
                                    date={incident.date}
                                    expandIcon={ !!incident.text ? <ExpandMoreIcon />
                                                                 : <CloseIcon color="disabled" /> }
                                    icon={
                                        !read ? <Tooltip title="This incident is new to you">
                                                   <NewReleasesIcon color="error" fontSize="small"/>
                                                </Tooltip>
                                              : <Tooltip title="You've read this incident">
                                                   <TaskAltIcon color="success" fontSize="small"/>
                                               </Tooltip>
                                    }
                                    summary={incident.summary}
                                    timezone={props.timezone} />

                                <AccordionDetails sx={{ pt: 0 }}>
                                    <Typography variant="body2" sx={{
                                        display: { xs: 'block', md: 'none' },
                                        fontStyle: 'italic',
                                    }}>
                                        {incident.summary}
                                    </Typography>

                                    { !incident.text &&
                                        <Box sx={{
                                            borderLeft: theme =>
                                                `4px solid ${theme.palette.warning.main}`,
                                            paddingLeft: 1.5,
                                            marginTop: { xs: 2, md: 0 },
                                        }}>
                                            <Typography variant="subtitle2">
                                                The details of this incident have been hidden.
                                            </Typography>
                                        </Box> }

                                    { !!incident.text &&
                                        <Box sx={{
                                            borderLeft: theme =>
                                                `4px solid ${theme.palette.success.main}`,
                                            paddingLeft: 1.5,
                                            marginTop: { xs: 2, md: 0 },
                                        }}>
                                            <Typography variant="subtitle2">
                                                { !!canAccessAuthorProfile &&
                                                    <MuiLink component={Link}
                                                             href={`./volunteers/${authorUserId}`}>
                                                        {incident.author}
                                                    </MuiLink> }
                                                { !canAccessAuthorProfile && incident.author }
                                                {' '}reported
                                                { !!incident.hidden &&
                                                    <Typography variant="inherit" color="warning"
                                                                component="span">
                                                        {' '}(hidden)
                                                    </Typography> }:
                                            </Typography>
                                            <Typography variant="body2"
                                                        sx={{ whiteSpace: 'pre-line' }}>
                                                {incident.text}
                                            </Typography>
                                        </Box> }

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
