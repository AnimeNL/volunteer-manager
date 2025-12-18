// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Divider from '@mui/material/Divider';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import Stack from '@mui/material/Stack';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { Alert } from '../components/Alert';
import { type DisplayHelpRequestTarget, kDisplayHelpRequestTarget } from '@lib/database/Types';
import { HeaderSectionCard } from '../components/HeaderSectionCard';
import { HelpRequestTarget } from '../components/HelpRequestTarget';
import { SetTitle } from '../components/SetTitle';
import { type Temporal, formatDate } from '@lib/Temporal';
import { generateScheduleMetadataFn } from '../lib/generateScheduleMetadataFn';
import { getEventBySlug } from '@lib/EventLoader';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tDisplays, tDisplaysRequests, tUsers } from '@lib/database';

import { kThemeImageVersion } from '@app/config';

/**
 * Props accepted by the <HelpRequestSummary> component.
 */
interface HelpRequestSummaryProps {
    /**
     * Whether the summary can be expanded.
     */
    expandable?: boolean;

    /**
     * The request for which the summary is being shown.
     */
    request: {
        /**
         * Person who has acknowledged this request, if any.
         */
        acknowledgedBy?: string;

        /**
         * Date and time on which the request was acknowledged.
         */
        acknowledgedDate?: Temporal.ZonedDateTime;

        /**
         * Person who has closed the request, if any.
         */
        closedBy?: string;

        /**
         * Date and time on which the request was closed.
         */
        closedDate?: Temporal.ZonedDateTime;

        /**
         * Date and time on which this request was received.
         */
        date: Temporal.ZonedDateTime;

        /**
         * Name of the display that requested help.
         */
        display: string;

        /**
         * Target of the help request, in other words, who is expected to help out?
         */
        target: DisplayHelpRequestTarget;
    };

    /**
     * Timezone in which the date and times should be displayed.
     */
    timezone: string;
}

/**
 * The <HelpRequestSummary> component displays a header
 */
function HelpRequestSummary(props: HelpRequestSummaryProps) {
    const { expandable, request, timezone } = props;

    const date = request.closedDate || request.acknowledgedDate || request.date;
    const target =
        request.target === kDisplayHelpRequestTarget.Nardo ? 'Advice'
                                                           : request.target;

    let state: 'pending' | 'acknowledged' | 'closed' = 'pending';
    if (!!request.acknowledgedDate)
        state = 'acknowledged';
    if (!!request.closedDate)
        state = 'closed';

    return (
        <AccordionSummary expandIcon={ !!expandable ? <ExpandMoreIcon /> : <NavigateNextIcon /> }>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1 }}>
                <HelpRequestTarget target={request.target} />
                <Typography variant="body2">
                    {target} — {request.display}
                </Typography>
                <Stack direction="row" alignItems="center" sx={{ ml: 'auto !important', pr: 1 }}>

                    { state === 'pending' &&
                        <Tooltip title="This request is yet to be acknowledged">
                            <ErrorOutlineIcon color="error" fontSize="small" />
                        </Tooltip> }
                    { state === 'acknowledged' &&
                        <Tooltip title={`${request.acknowledgedBy} is on their way`}>
                            <RadioButtonUncheckedIcon color="warning" fontSize="small" />
                        </Tooltip> }
                    { state === 'closed' &&
                        <Tooltip title={`${request.closedBy} dealt with the request`}>
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
 * The <ScheduleHelpRequestsPage> component displays a page containing the recent help requests. It
 * is only available to a subset of volunteers.
 */
export default async function ScheduleHelpRequestsPage(
    props: PageProps<'/schedule/[event]/help-requests'>)
{
    const params = await props.params;

    await requireAuthenticationContext({
        check: 'event',
        event: params.event,
        permission: {
            permission: 'event.help-requests',
            scope: {
                event: params.event,
            },
        },
    });

    const event = await getEventBySlug(params.event);
    if (!event)
        notFound();

    const acknowledgedUserJoin = tUsers.forUseInLeftJoinAs('auj');
    const closedUserJoin = tUsers.forUseInLeftJoinAs('cuj');

    const requests = await db.selectFrom(tDisplaysRequests)
        .innerJoin(tDisplays)
            .on(tDisplays.displayId.equals(tDisplaysRequests.displayId))
        .leftJoin(acknowledgedUserJoin)
            .on(acknowledgedUserJoin.userId.equals(tDisplaysRequests.requestAcknowledgedBy))
        .leftJoin(closedUserJoin)
            .on(closedUserJoin.userId.equals(tDisplaysRequests.requestClosedBy))
        .where(tDisplaysRequests.requestEventId.equals(event.id))
        .select({
            id: tDisplaysRequests.requestId,
            date: tDisplaysRequests.requestReceivedDate,
            target: tDisplaysRequests.requestReceivedTarget,
            display: tDisplays.displayLabel.valueWhenNull(tDisplays.displayIdentifier),

            acknowledgedBy: acknowledgedUserJoin.name,
            acknowledgedDate: tDisplaysRequests.requestAcknowledgedDate,

            closedBy: closedUserJoin.name,
            closedDate: tDisplaysRequests.requestClosedDate,
            closedReason: tDisplaysRequests.requestClosedReason,
        })
        .orderBy('closedDate', 'desc nulls last')
            .orderBy('acknowledgedDate', 'desc nulls first')
            .orderBy('date', 'desc')
        .executeSelectMany();

    type Request = typeof requests[number];

    const activeRequests: Request[] = [];
    const closedRequests: Request[] = [];

    for (const request of requests) {
        if (!request.acknowledgedBy || !request.closedBy)
            activeRequests.push(request);
        else
            closedRequests.push(request);
    }

    return (
        <>
            <SetTitle title="Help Requests" />
            <HeaderSectionCard>
                <Box sx={{
                    backgroundImage: `url(/images/theme/help-requests.jpg?${kThemeImageVersion})`,
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    width: '100%',
                    aspectRatio: 3.5 }} />
            </HeaderSectionCard>
            { !!activeRequests.length &&
                <Box>
                    <Typography variant="button" sx={{ color: 'text.secondary' }}>
                        Active requests ({activeRequests.length})
                    </Typography>
                    <Card sx={{ mt: 1 }}>
                        <Stack divider={ <Divider flexItem /> }>
                            { activeRequests.map(request =>
                                <CardActionArea key={request.id} component={Link}
                                                href={`./help-requests/${request.id}`}>
                                    <HelpRequestSummary request={request}
                                                        timezone={event.timezone} />
                                </CardActionArea> )}
                        </Stack>
                    </Card>
                </Box> }
            { !!closedRequests.length &&
                <Box>
                    <Typography variant="button" sx={{ color: 'text.secondary' }}>
                        Closed requests ({closedRequests.length})
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                        { closedRequests.map(request =>
                            <Accordion key={request.id}>
                                <HelpRequestSummary expandable request={request}
                                                    timezone={event.timezone} />
                                <AccordionDetails sx={{ pt: 0 }}>
                                    <Typography variant="body2">
                                        Closed by {request.closedBy}:
                                        "<em>{ request.closedReason ?? 'no reason' }</em>" —{' '}
                                        <MuiLink component={Link}
                                                 href={`./help-requests/${request.id}`}>
                                            read more
                                        </MuiLink>
                                    </Typography>
                                </AccordionDetails>
                            </Accordion> )}
                    </Box>
                </Box> }
            { (!activeRequests.length && !closedRequests.length) &&
                <Alert elevation={1} severity="info">
                    <AlertTitle>Nobody has requested help yet!</AlertTitle>
                    Help requests from our volunteering displays will appear here.
                </Alert> }
        </>
    );
}

export const generateMetadata = generateScheduleMetadataFn([ 'Help Requests' ]);
