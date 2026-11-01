// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import ShareIcon from '@mui/icons-material/Share';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { CachedEvent } from '@lib/cache';
import { ExpandableSection } from '@app/admin/components/ExpandableSection';
import { formatDate } from '@lib/Temporal';
import { readUserSetting } from '@lib/UserSettings';
import db, { tRoles, tTeams, tTrainings, tTrainingsAssignments, tTrainingsExtra, tUsers,
    tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Information about an individual training session and its assigned participants.
 */
interface TrainingSessionConfirmation {
    capacity: number;
    date: Temporal.ZonedDateTime;
    participants: {
        name: string;
        userId?: number;
        team?: string;
        confirmed: boolean;
    }[];
}

/**
 * Props accepted by the <ConfirmedParticipationSection> component.
 */
interface ConfirmedParticipationSectionProps {
    /**
     * Whether a link to the data export tool should be displayed on the section header.
     */
    enableExport?: boolean;

    /**
     * Information about the event for which confirmed training participation is being shown.
     */
    event: CachedEvent;

    /**
     * Unique ID of the signed-in user, to persist the section's expanded state.
     */
    userId: number;
}

/**
 * Displays a collapsible section with a tabular overview of who is participating in which training
 * session for the event.
 */
export async function ConfirmedParticipationSection(props: ConfirmedParticipationSectionProps) {
    const { enableExport, event, userId } = props;

    const trainingsAssignmentsJoin = tTrainingsAssignments.forUseInLeftJoin();

    const dbInstance = db;
    const assignments = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .leftJoin(trainingsAssignmentsJoin)
            .on(trainingsAssignmentsJoin.eventId.equals(tUsersEvents.eventId))
                .and(trainingsAssignmentsJoin.assignmentUserId.equals(tUsersEvents.userId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .and(
                tUsersEvents.trainingEligible.equals(/* true= */ 1).or(
                    tRoles.roleTrainingEligible.equals(/* true= */ 1)))
        .select({
            userId: tUsersEvents.userId,
            name: tUsers.name,
            team: tTeams.teamSlug,
            assignedTrainingId: trainingsAssignmentsJoin.assignmentTrainingId,
            confirmed: trainingsAssignmentsJoin.assignmentConfirmed,
        })
        .groupBy(tUsersEvents.userId)
        .orderBy('name', 'asc')
        .executeSelectMany();

    const extraParticipants = await dbInstance.selectFrom(tTrainingsExtra)
        .leftJoin(trainingsAssignmentsJoin)
            .on(trainingsAssignmentsJoin.eventId.equals(tTrainingsExtra.eventId))
                .and(trainingsAssignmentsJoin.assignmentExtraId.equals(
                    tTrainingsExtra.trainingExtraId))
        .where(tTrainingsExtra.eventId.equals(event.id))
            .and(tTrainingsExtra.trainingExtraVisible.equals(/* true= */ 1))
        .select({
            name: tTrainingsExtra.trainingExtraName,
            assignedTrainingId: trainingsAssignmentsJoin.assignmentTrainingId,
            confirmed: trainingsAssignmentsJoin.assignmentConfirmed,
        })
        .orderBy(tTrainingsExtra.trainingExtraName, 'asc')
        .executeSelectMany();

    const trainings = await dbInstance.selectFrom(tTrainings)
        .where(tTrainings.eventId.equals(event.id))
            .and(tTrainings.trainingVisible.equals(/* true= */ 1))
        .select({
            id: tTrainings.trainingId,
            trainingCapacity: tTrainings.trainingCapacity,
            trainingStart: tTrainings.trainingStart,
        })
        .orderBy(tTrainings.trainingStart, 'asc')
        .executeSelectMany();

    const trainingConfirmations: Record<number, TrainingSessionConfirmation> = {};
    let totalCount = 0;

    for (const training of trainings) {
        trainingConfirmations[training.id] = {
            capacity: training.trainingCapacity,
            date: training.trainingStart.withTimeZone(event.timeZone),
            participants: [],
        };
    }

    const allParticipants = [
        ...assignments,
        ...extraParticipants.map(extra => ({ ...extra, userId: undefined, team: undefined })),
    ];

    for (const assignment of allParticipants) {
        if (!assignment.assignedTrainingId)
            continue;

        if (!Object.hasOwn(trainingConfirmations, assignment.assignedTrainingId))
            continue;

        totalCount++;
        trainingConfirmations[assignment.assignedTrainingId].participants.push({
            name: assignment.name,
            userId: assignment.userId,
            team: assignment.team,
            confirmed: !!assignment.confirmed,
        });
    }

    if (!totalCount)
        return null;

    const confirmations = Object.values(trainingConfirmations);
    for (const confirmation of confirmations) {
        confirmation.participants.sort((lhs, rhs) => {
            if (lhs.confirmed !== rhs.confirmed)
                return lhs.confirmed ? -1 : 1;

            return lhs.name.localeCompare(rhs.name);
        });
    }

    confirmations.sort((lhs, rhs) => Temporal.ZonedDateTime.compare(lhs.date, rhs.date));

    const rows = [];
    for (let index = 0;; ++index) {
        const row = [];

        let count = 0;
        for (const session of confirmations) {
            if (session.participants.length > index)
                count++;

            row.push({
                overflow: index >= session.capacity,
                ...session.participants[index],
            });
        }

        if (!count)
            break;

        rows.push(row);
    }

    const defaultExpanded =
        await readUserSetting(userId, 'user-admin-training-expand-confirmed') ?? false;

    let headerAction: React.ReactNode;
    if (enableExport) {
        headerAction = (
            <Tooltip title="Export participation">
                <IconButton LinkComponent={Link} href="/admin/organisation/exports/create"
                            size="small">
                    <ShareIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        );
    }

    return (
        <ExpandableSection defaultExpanded={!!defaultExpanded} headerAction={headerAction}
                           icon={ <EventAvailableIcon /> }
                           setting="user-admin-training-expand-confirmed" subtitle={`${totalCount}`}
                           title="Confirmed participation">
            <Stack direction="column" spacing={1.5} sx={{ display: { xs: 'flex', md: 'none' } }}>
                { confirmations.map((session, index) => {
                    const overCapacity = session.participants.length > session.capacity;
                    return (
                        <Paper key={index} variant="outlined" sx={{ p: 1.5 }}>
                            <Stack direction="row" spacing={1}
                                   sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="subtitle2">
                                    { formatDate(session.date, 'dddd, MMMM D') }
                                </Typography>
                                <Typography variant="caption"
                                            color={overCapacity ? 'warning.main' : 'text.secondary'}>
                                    {session.participants.length} / {session.capacity}
                                </Typography>
                            </Stack>
                            <Divider sx={{ my: 1 }} />
                            { session.participants.length === 0 &&
                                <Typography variant="body2" color="text.disabled"
                                            sx={{ fontStyle: 'italic' }}>
                                    No assigned participants
                                </Typography> }
                            { session.participants.length > 0 &&
                                <Stack direction="column" spacing={0.5}>
                                    { session.participants.map((participant, participantIndex) => {
                                        const overflow = participantIndex >= session.capacity;
                                        const href =
                                            `/admin/events/${event.slug}/${participant.team}` +
                                            `/volunteers/${participant.userId}`;

                                        let color: string | undefined;
                                        if (overflow)
                                            color = 'warning.main';
                                        else if (!participant.confirmed)
                                            color = 'text.disabled';

                                        return (
                                            <Stack key={participantIndex} direction="row"
                                                   spacing={1.5} sx={{ alignItems: 'baseline' }}>
                                                <Typography variant="caption" color="text.disabled"
                                                            sx={{
                                                                minWidth: 20,
                                                                textAlign: 'right',
                                                            }}>
                                                    {participantIndex + 1}
                                                </Typography>
                                                <Typography variant="body2" sx={{
                                                    color,
                                                    fontStyle: participant.confirmed
                                                        ? undefined
                                                        : 'italic',
                                                    '& a': { color },
                                                }}>
                                                    { !participant.userId && participant.name }
                                                    { !!participant.userId &&
                                                        <MuiLink component={Link} href={href}>
                                                            {participant.name}
                                                        </MuiLink> }
                                                </Typography>
                                            </Stack>
                                        );
                                    }) }
                                </Stack> }
                        </Paper>
                    );
                }) }
            </Stack>
            <Table size="small" sx={{ display: { xs: 'none', md: 'table' }, marginTop: '-8px' }}>
                <TableHead>
                    <TableRow>
                        <TableCell width="50" />
                        { confirmations.map((session, index) =>
                            <TableCell key={index} align="center">
                                { formatDate(session.date, 'dddd, MMMM D') }
                            </TableCell> )}
                        <TableCell width="50" />
                    </TableRow>
                </TableHead>
                <TableBody>
                    { rows.map((row, index) =>
                        <TableRow key={index}>
                            <TableCell sx={{ color: 'text.disabled' }} align="left">
                                {index + 1}
                            </TableCell>
                            { row.map((participant, index2) => {
                                if (!participant.name)
                                    return <TableCell key={index2} />;

                                const href =
                                    `/admin/events/${event.slug}/${participant.team}/volunteers/` +
                                    `${participant.userId}`;

                                let color: string | undefined;
                                if (participant.overflow)
                                    color = 'warning.main';
                                else if (!participant.confirmed)
                                    color = 'text.disabled';

                                return (
                                    <TableCell key={index2} align="center">
                                        <Typography variant="body2" sx={{
                                            color,
                                            fontStyle: participant.confirmed ? '' : 'italic',
                                            '& a': { color } }}>

                                            { !participant.userId && participant.name }
                                            { !!participant.userId &&
                                                <MuiLink component={Link} href={href}>
                                                    {participant.name}
                                                </MuiLink> }

                                        </Typography>
                                    </TableCell>
                                );
                            } )}
                            <TableCell sx={{ color: 'text.disabled' }} align="right">
                                {index + 1}
                            </TableCell>
                        </TableRow> )}
                </TableBody>
            </Table>
        </ExpandableSection>
    );
}
