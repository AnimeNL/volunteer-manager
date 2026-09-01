// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import HelpIcon from '@mui/icons-material/Help';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';

import { KeyValueList } from '@app/admin/components/KeyValueList';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { formatDuration } from '@lib/Temporal';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tDisplays, tDisplaysRequests, tEvents, tUsers } from '@lib/database';

/**
 * The display request page provides detailed access to an individual help request received from one
 * of the displays, providing a detailed timeline and insights in what happened, and when.
 */
export default async function DisplayRequestPage(
    props: PageProps<'/admin/organisation/displays/requests/[id]'>)
{
    await requireAuthentication('organisation.displays');

    const acknowledgedUserJoin = tUsers.forUseInLeftJoinAs('auj');
    const closedUserJoin = tUsers.forUseInLeftJoinAs('cuj');

    const { id } = await props.params;

    const request = await db.selectFrom(tDisplaysRequests)
        .innerJoin(tDisplays)
            .on(tDisplays.displayId.equals(tDisplaysRequests.displayId))
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tDisplaysRequests.requestEventId))
        .leftJoin(acknowledgedUserJoin)
            .on(acknowledgedUserJoin.userId.equals(tDisplaysRequests.requestAcknowledgedBy))
        .leftJoin(closedUserJoin)
            .on(closedUserJoin.userId.equals(tDisplaysRequests.requestClosedBy))
        .where(tDisplaysRequests.requestId.equals(parseInt(id, /* radix= */ 10)))
        .select({
            id: tDisplaysRequests.requestId,
            date: tDisplaysRequests.requestReceivedDate,
            target: tDisplaysRequests.requestReceivedTarget,
            display: tDisplays.displayLabel.valueWhenNull(tDisplays.displayIdentifier),
            event: tEvents.eventShortName,

            acknowledgedBy: acknowledgedUserJoin.name,
            acknowledgedByUserId: acknowledgedUserJoin.userId,
            acknowledgedDate: tDisplaysRequests.requestAcknowledgedDate,

            closedBy: closedUserJoin.name,
            closedByUserId: closedUserJoin.userId,
            closedDate: tDisplaysRequests.requestClosedDate,
            closedReason: tDisplaysRequests.requestClosedReason,
        })
        .executeSelectNoneOrOne();

    if (!request)
        notFound();

    let acknowledgedLatency: string | undefined;

    if (!!request.acknowledgedDate) {
        acknowledgedLatency =
            formatDuration(request.date.until(request.acknowledgedDate, { largestUnit: 'hours' }),
                /* noPrefix= */ true);
    }

    let closedLatency: string | undefined;

    if (!!request.closedDate) {
        closedLatency =
            formatDuration(request.date.until(request.closedDate, { largestUnit: 'hours' }),
                /* noPrefix= */ true);
    }

    return (
        <>
            <Section icon={ <HelpIcon color="primary" /> }
                     title={`Help request #${id}`}
                     breadcrumbs={[
                         { label: 'Organisation', href: '/admin/organisation' },
                         { label: 'Displays', href: '/admin/organisation/displays' },
                         { label: 'Help requests', href: '/admin/organisation/displays/requests' },
                         { label: `#${id}` },
                     ]}>
                <SectionIntroduction>
                    Help request issued by <strong>{request.display}</strong> during {request.event}.
                </SectionIntroduction>
            </Section>
            <Section noHeader back="Back to help requests" tabs>
                <KeyValueList items={[
                    {
                        key: 'Date',
                        value: request.date.toString(),
                        valueTemplate: 'localDateTime',
                    },
                    {
                        key: 'Received from display',
                        value: request.display,
                    },
                    {
                        key: 'Received for event',
                        value: request.event,
                    },
                    {
                        key: 'Request target',
                        value: request.target,
                    },
                ]} />
            </Section>
            { !request.acknowledgedBy &&
                <Section noHeader>
                    <Alert severity="warning">
                        This request has not been acknowledged yet.
                    </Alert>
                </Section> }
            { !!request.acknowledgedBy &&
                <Section title="Acknowledgement">
                    <KeyValueList items={[
                        {
                            key: 'Acknowledged',
                            value: (
                                <Typography variant="body2">
                                    <LocalDateTime
                                        dateTime={request.acknowledgedDate!.toString()}
                                        format="YYYY-MM-DD HH:mm:ss" />
                                    {' '}(latency: {acknowledgedLatency})
                                </Typography>
                            ),
                            valueTemplate: 'component',
                        },
                        {
                            key: 'Volunteer',
                            value: {
                                id: request.acknowledgedByUserId!,
                                name: request.acknowledgedBy!,
                            },
                            valueTemplate: 'account',
                        },
                    ]} />
                </Section> }
            { !request.closedBy &&
                <Section noHeader>
                    <Alert severity="warning">
                        This request has not been closed yet.
                    </Alert>
                </Section> }
            { !!request.closedBy &&
                <Section title="Resolution">
                    <KeyValueList items={[
                        {
                            key: 'Closed',
                            value: (
                                <Typography variant="body2">
                                    <LocalDateTime
                                        dateTime={request.closedDate!.toString()}
                                        format="YYYY-MM-DD HH:mm:ss" />
                                    {' '}(latency: {closedLatency})
                                </Typography>
                            ),
                            valueTemplate: 'component',
                        },
                        {
                            key: 'Volunteer',
                            value: {
                                id: request.closedByUserId!,
                                name: request.closedBy!,
                            },
                            valueTemplate: 'account',
                        },
                        {
                            key: 'Reason',
                            value: request.closedReason ?? 'No reason given…',
                        },
                    ]} />
                </Section> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id', prefix: '#' }, 'Help requests', 'Displays',
                             'Organisation');
