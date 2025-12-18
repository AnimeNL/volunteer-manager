// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { BackButtonGrid } from '@app/admin/components/BackButtonGrid';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';
import { createGenerateMetadataFn } from '../../../../lib/generatePageMetadata';
import { formatDuration } from '@lib/Temporal';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tDisplays, tDisplaysRequests, tEvents, tUsers } from '@lib/database';

/**
 * The display request page provides detailed access to an individual help request received from one
 * of the displays, providing a detailed timeline and insights in what happened, and when.
 */
export default async function DisplayRequestPage(
    props: PageProps<'/admin/organisation/displays/requests/[id]'>)
{
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'organisation.displays',
    });

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

    const accountBaseUrl = '/admin/organisation/accounts/';

    return (
        <Grid container spacing={2}>
            <BackButtonGrid href="/admin/organisation/displays/requests">
                Back to help requests
            </BackButtonGrid>

            <Grid size={{ xs: 12 }} sx={{ mt: -1 }}><Divider /></Grid>
            <Grid size={{ xs: 12 }} sx={{ mt: -2 }}>
                <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell width="25%" component="th" scope="row">
                                Date
                            </TableCell>
                            <TableCell>
                                <LocalDateTime dateTime={request.date.toString()}
                                               format="MMMM D, YYYY [at] H:mm:ss" />
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell width="25%" component="th" scope="row">
                                Received from display
                            </TableCell>
                            <TableCell>
                                {request.display}
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell width="25%" component="th" scope="row">
                                Received for event
                            </TableCell>
                            <TableCell>
                                {request.event}
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell width="25%" component="th" scope="row">
                                Request target
                            </TableCell>
                            <TableCell>
                                {request.target}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </Grid>

            { !request.acknowledgedBy &&
                <Grid size={{ xs: 12 }}>
                    <Alert severity="warning">
                        This request has not been acknowledged yet.
                    </Alert>
                </Grid> }
            { !!request.acknowledgedBy &&
                <Grid size={{ xs: 12 }}>
                    <Typography variant="h6" sx={{ mt: -1 }}>
                        Acknowledgement
                    </Typography>
                    <Table>
                        <TableBody>
                            <TableRow>
                                <TableCell width="25%" component="th" scope="row">
                                    Acknowledged
                                </TableCell>
                                <TableCell>
                                    <LocalDateTime dateTime={request.acknowledgedDate!.toString()}
                                                   format="MMMM D, YYYY [at] H:mm:ss" />
                                    {' '}(latency: {acknowledgedLatency})
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell component="th" scope="row">
                                    Volunteer
                                </TableCell>
                                <TableCell>
                                    <MuiLink
                                        component={Link}
                                        href={`${accountBaseUrl}${request.acknowledgedByUserId}`}>

                                        {request.acknowledgedBy}

                                    </MuiLink>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </Grid> }

            { !request.closedBy &&
                <Grid size={{ xs: 12 }}>
                    <Alert severity="warning">
                        This request has not been closed yet.
                    </Alert>
                </Grid> }
            { !!request.closedBy &&
                <Grid size={{ xs: 12 }}>
                    <Typography variant="h6" sx={{ mt: -1 }}>
                        Resolution
                    </Typography>
                    <Table>
                        <TableBody>
                            <TableRow>
                                <TableCell width="25%" component="th" scope="row">
                                    Closed
                                </TableCell>
                                <TableCell>
                                    <LocalDateTime dateTime={request.closedDate!.toString()}
                                                   format="MMMM D, YYYY [at] H:mm:ss" />
                                    {' '}(latency: {closedLatency})
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell component="th" scope="row">
                                    Volunteer
                                </TableCell>
                                <TableCell>
                                    <MuiLink component={Link}
                                             href={`${accountBaseUrl}${request.closedByUserId}`}>
                                        {request.closedBy}
                                    </MuiLink>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell component="th" scope="row">
                                    Reason
                                </TableCell>
                                <TableCell>
                                    {request.closedReason ?? 'No reason given…'}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </Grid> }

        </Grid>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Help request', 'Displays', 'Organisation');
