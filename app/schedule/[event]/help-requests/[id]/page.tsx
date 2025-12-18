// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import Step from '@mui/material/Step';
import StepContent from '@mui/material/StepContent';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Typography from '@mui/material/Typography';

import { AcknowledgeForm } from './AcknowledgeForm';
import { CloseForm } from './CloseForm';
import { HeaderSectionCard } from '../../components/HeaderSectionCard';
import { HelpRequestTarget } from '../../components/HelpRequestTarget';
import { SetTitle } from '../../components/SetTitle';
import { formatDate, formatDuration } from '@lib/Temporal';
import { generateScheduleMetadata, getTitleCache } from '../../lib/generateScheduleMetadataFn';
import { getEventBySlug } from '@lib/EventLoader';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tDisplays, tDisplaysRequests, tUsers } from '@lib/database';

import { kDisplayHelpRequestTarget } from '@lib/database/Types';
import { kHelpRequestColours } from '@app/admin/organisation/displays/requests/HelpRequestColours';
import { kThemeImageVersion } from '@app/config';

/**
 * The <ScheduleHelpRequestPage> component displays a page for a given help request. It's only
 * available for volunteers with a specific permission, as it potentially could contain sensitive
 * information.
 */
export default async function ScheduleHelpRequestPage(
    props: PageProps<'/schedule/[event]/help-requests/[id]'>)
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

    const request = await db.selectFrom(tDisplaysRequests)
        .innerJoin(tDisplays)
            .on(tDisplays.displayId.equals(tDisplaysRequests.displayId))
        .leftJoin(acknowledgedUserJoin)
            .on(acknowledgedUserJoin.userId.equals(tDisplaysRequests.requestAcknowledgedBy))
        .leftJoin(closedUserJoin)
            .on(closedUserJoin.userId.equals(tDisplaysRequests.requestClosedBy))
        .where(tDisplaysRequests.requestEventId.equals(event.id))
            .and(tDisplaysRequests.requestId.equals(parseInt(params.id, /* radix= */ 10)))
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
        .executeSelectNoneOrOne();

    if (!request)
        notFound();

    const [ foreground, background ] = kHelpRequestColours[request.target];

    const received = formatDate(request.date.withTimeZone(event.timezone), 'dddd[, at ]HH:mm');

    let activeStep: number = 0;

    let acknowledged: string | undefined;
    let acknowledgedDiff: string | undefined;
    if (!!request.acknowledgedBy && !!request.acknowledgedDate) {
        activeStep++;
        acknowledged = formatDate(
            request.acknowledgedDate.withTimeZone(event.timezone), 'dddd[, at ]HH:mm');
        acknowledgedDiff =
            formatDuration(request.date.until(request.acknowledgedDate), /* noPrefix= */ true);
    }

    let closed: string | undefined;
    let closedDiff: string | undefined;
    if (!!request.closedBy && !!request.closedDate) {
        activeStep += 2;
        closed = formatDate(request.closedDate.withTimeZone(event.timezone), 'dddd[, at ]HH:mm');
        closedDiff = formatDuration(request.date.until(request.closedDate), /* noPrefix= */ true);
    }

    const target =
        request.target === kDisplayHelpRequestTarget.Nardo ? 'Nardo\'s Advice'
                                                           : request.target;

    return (
        <>
            <SetTitle title={request.display} />
            <HeaderSectionCard>
                <Box sx={{
                    backgroundImage: `url(/images/theme/help-request.jpg?${kThemeImageVersion})`,
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    width: '100%',
                    aspectRatio: 3.5 }} />
            </HeaderSectionCard>
            <Card>
                <CardHeader avatar={ <HelpRequestTarget target={request.target} /> }
                            title={`${request.display} asks for ${target}`}
                            titleTypographyProps={{ variant: 'subtitle2' }}
                            subheader="Request received from their Volunteering Display" />
            </Card>
            <Card sx={{ px: 2, py: 1 }}>
                <Stepper orientation="vertical" activeStep={activeStep}
                         sx={{
                             '& .MuiSvgIcon-root.Mui-active': { color: background },
                             '& .MuiSvgIcon-root.Mui-active text': { fill: foreground },
                             '& .MuiSvgIcon-root.Mui-completed': { color: background },
                             '& .MuiStepContent-root': { pl: '28px' },
                             '& .MuiStepLabel-iconContainer': { pr: 2 },
                         }}>
                    <Step expanded>
                        <StepLabel>Request received</StepLabel>
                        <StepContent>
                            <Typography variant="body2">
                                Help was requested on {received}
                            </Typography>
                        </StepContent>
                    </Step>
                    <Step expanded>
                        <StepLabel>Acknowledged</StepLabel>
                        { !!request.acknowledgedBy &&
                            <StepContent>
                                <Typography variant="body2">
                                    Request was acknowledged by {request.acknowledgedBy} on{' '}
                                    {acknowledged} (
                                    <Typography component="span" variant="body2"
                                                sx={{ color: 'error.main' }}>
                                        +{acknowledgedDiff}
                                    </Typography>)
                                </Typography>
                            </StepContent> }
                    </Step>
                    <Step expanded>
                        <StepLabel>Closed</StepLabel>
                        { !!request.closedBy &&
                            <StepContent sx={{ pb: 1 }}>
                                <Typography variant="body2">
                                    Request was closed by {request.closedBy} on {closed}{' '}(
                                    <Typography component="span" variant="body2"
                                                sx={{ color: 'error.main' }}>
                                        +{closedDiff}
                                    </Typography>
                                    ): "<em>{request.closedReason ?? 'no reason'}</em>"
                                </Typography>
                            </StepContent> }
                    </Step>
                </Stepper>
            </Card>
            { (!request.acknowledgedBy && !request.closedBy) &&
                <AcknowledgeForm event={event.slug} requestId={request.id}
                                 target={request.target} /> }
            { (!!request.acknowledgedBy && !request.closedBy) &&
                <CloseForm event={event.slug} requestId={request.id} target={request.target} /> }
        </>
    );
}

export async function generateMetadata(props: PageProps<'/schedule/[event]/help-requests/[id]'>) {
    const cache = getTitleCache('help-requests');
    const id = (await props.params).id;

    let displayName = cache.get(id);
    if (!displayName) {
        displayName = await db.selectFrom(tDisplaysRequests)
            .innerJoin(tDisplays)
                .on(tDisplays.displayId.equals(tDisplaysRequests.displayId))
            .where(tDisplaysRequests.requestId.equals(parseInt(id, /* radix= */ 10)))
            .selectOneColumn(tDisplays.displayLabel)
            .executeSelectNoneOrOne() ?? 'Unknown display';

        cache.set(id, displayName);
    }

    return generateScheduleMetadata(props, [ displayName!, 'Help Requests' ]);
}
