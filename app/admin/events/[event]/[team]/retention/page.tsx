// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { RetentionDataTable } from './RetentionDataTable';
import { RetentionOutreachList } from './RetentionOutreachList';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { formatDate } from '@lib/Temporal';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { getLeadersForEvent } from '@app/admin/lib/getLeadersForEvent';
import { readSetting } from '@lib/Settings';
import { sendCommunication } from '@app/admin/components/CommunicationDialog/sendCommunication';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tEvents, tRetention, tTeams, tUsersEvents, tUsers } from '@lib/database';

import { kRetentionStatus } from '@lib/database/Types';

/**
 * Resolves context and verifies access for retention actions.
 */
async function verifyAccessAndGetContext(
    authenticationContext: any, eventId: number, teamId: number, recipientId: number)
{
    const event = await db.selectFrom(tEvents)
        .where(tEvents.eventId.equals(eventId))
        .select({
            slug: tEvents.eventSlug,
            shortName: tEvents.eventShortName,
        })
        .executeSelectNoneOrOne();

    const teamSlug = await db.selectFrom(tTeams)
        .where(tTeams.teamId.equals(teamId))
        .selectOneColumn(tTeams.teamSlug)
        .executeSelectNoneOrOne();

    const volunteer = await db.selectFrom(tUsers)
        .where(tUsers.userId.equals(recipientId))
        .select({
            emailAddress: tUsers.username,
            phoneNumber: tUsers.phoneNumber,
        })
        .executeSelectNoneOrOne();

    if (!event || !teamSlug || !volunteer)
        notFound();

    executeAccessCheck(authenticationContext, {
        check: 'admin-event',
        event: event.slug,
        permission: {
            permission: 'event.retention',
            operation: 'update',
            scope: {
                event: event.slug,
                team: teamSlug,
            },
        },
    });

    return { event, volunteer };
}

/**
 * Assigns the volunteer and records the outreach activity.
 */
async function recordRetentionOutreach(
    eventId: number, teamId: number, recipientId: number, assigneeId: number,
    medium: 'e-mail' | 'WhatsApp')
{
    const noteDate = formatDate(Temporal.Now.instant(), 'MMMM Do');
    const noteNotes = medium === 'e-mail' ? `Sent an e-mail (${noteDate})`
                                          : `Sent a WhatsApp message (${noteDate})`;

    const affectedRows = await db.insertInto(tRetention)
        .set({
            userId: recipientId,
            eventId: eventId,
            teamId: teamId,
            retentionStatus: kRetentionStatus.Contacting,
            retentionAssigneeId: assigneeId,
            retentionNotes: noteNotes,
        })
        .onConflictDoUpdateSet({
            retentionStatus: kRetentionStatus.Contacting,
            retentionAssigneeId: assigneeId,
            retentionNotes: noteNotes,
        })
        .executeInsert();

    if (!affectedRows)
        throw new Error('Unable to assign this volunteer to you…');
}

/**
 * Server Action that will be invoked by the <CommunicationIconButton> component when a message
 * should be send on the user's behalf. All input should be treated as untrusted until verified.
 */
async function sendRetentionEmail(
    eventId: number, teamId: number, recipientId: number,
    subject?: string, message?: string)
{
    'use server';

    return executeServerAction(new FormData, z.object({ /* none */ }), async (data, props) => {
        const { volunteer } = await verifyAccessAndGetContext(
            props.authenticationContext, eventId, teamId, recipientId);

        if (!subject || !message)
            return { success: false, error: 'Subject and/or message are missing from the request' };

        if (!volunteer.emailAddress)
            return { success: false, error: 'We don\'t have their e-mail address on file…' };

        await recordRetentionOutreach(eventId, teamId, recipientId, props.user.id, 'e-mail');
        await sendCommunication({
            sender: props.user,
            recipient: 1,
            subject,
            message,
            metadata: {
                eventId,
                teamId,
                promptId: 'participation-reminder',
            },
        });

        return {
            success: true,
            message: 'The e-mail has been sent, thank you for keeping them in the loop!',
        };
    });
}

/**
 * Server Action that will be invoked when a WhatsApp reminder message was sent.
 * It assigns the volunteer to the current user, writes a log entry, and returns
 * the target volunteer's phone number.
 */
async function sendRetentionWhatsApp(
    eventId: number, teamId: number, recipientId: number, message: string)
{
    'use server';

    return executeServerAction(new FormData, z.object({ /* none */ }), async (data, props) => {
        const { event, volunteer } = await verifyAccessAndGetContext(
            props.authenticationContext, eventId, teamId, recipientId);

        if (!message || !message.trim())
            return { success: false, error: 'Message is missing from the request' };

        if (!volunteer.phoneNumber)
            return { success: false, error: 'We don\'t have their phone number on file…' };

        await recordRetentionOutreach(eventId, teamId, recipientId, props.user.id, 'WhatsApp');

        RecordLog({
            type: kLogType.AdminEventRetentionMessage,
            severity: kLogSeverity.Info,
            sourceUser: props.user,
            targetUser: recipientId,
            data: {
                channel: 'WhatsApp',
                event: event.shortName,
                message: message,
            }
        });

        return {
            success: true,
            phoneNumber: volunteer.phoneNumber,
        };
    });
}

/**
 * The retention page displays a recruiting tool to understand how participants from the past two
 * events are interested in participating in the upcoming event.
 */
export default async function EventTeamRetentionPage(
    props: PageProps<'/admin/events/[event]/[team]/retention'>)
{
    const params = await props.params;

    const { access, event, team, user } = await verifyAccessAndFetchPageInfo(props.params, {
        permission: 'event.retention',
        operation: 'read',
        scope: {
            event: params.event,
            team: params.team,
        },
    });

    const usersEventJoin = tUsersEvents.forUseInLeftJoin();

    const assignedVolunteers = await db.selectFrom(tRetention)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tRetention.userId))
        .leftJoin(usersEventJoin)
            .on(usersEventJoin.userId.equals(tRetention.userId))
            .and(usersEventJoin.eventId.equals(tRetention.eventId))
        .where(tRetention.eventId.equals(event.id))
            .and(tRetention.teamId.equals(team.id))
            .and(tRetention.retentionStatus.notEquals(kRetentionStatus.Declined))
            .and(tRetention.retentionAssigneeId.equals(user.id))
            .and(usersEventJoin.registrationStatus.isNull())
        .select({
            id: tRetention.userId,
            name: tUsers.name,
            email: tUsers.username,
            phoneNumber: tUsers.phoneNumber,
        })
        .executeSelectMany();

    const comprehensiveLeaders = await getLeadersForEvent(event.id);
    const leaders = comprehensiveLeaders.map(leader => leader.label);

    const readOnly = !access.can('event.retention', 'update', {
        event: event.slug,
        team: team.slug,
    });

    const whatsAppLink = `https://${team.domain}/registration`;
    const whatsAppMessage = await readSetting('retention-whatsapp-message') ?? '{name}, {link}?!';

    return (
        <>
            <Collapse in={!!assignedVolunteers.length} unmountOnExit>
                <RetentionOutreachList assignedVolunteers={assignedVolunteers} />
            </Collapse>
            <Paper sx={{ p: 2 }}>
                <Typography variant="h5">
                    {team.name.replace(/s$/, '')} retention
                    <Typography component="span" variant="h5" sx={{
                        color: 'action.active',
                        paddingLeft: 1
                    }}>
                        ({event.shortName})
                    </Typography>
                </Typography>
                { readOnly &&
                    <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
                        This table displays all {team.name} who participated in the past few years,
                        and might want to participate again.
                    </Alert> }
                { !readOnly &&
                    <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
                        This table displays all {team.name} who participated in the past few years,
                        and might want to participate again. Reach out by clicking on either of the
                        icons in the "Assignee" column, or double click on the column to manually
                        assign it in case outreach has already started.
                    </Alert> }
                <RetentionDataTable whatsAppLink={whatsAppLink} whatsAppMessage={whatsAppMessage}
                                    readOnly={readOnly}
                                    event={event.slug} leaders={leaders} team={team.slug}
                                    eventId={event.id} teamId={team.id} eventName={event.shortName}
                                    sendEmailFn={
                                        sendRetentionEmail.bind(null, event.id, team.id) }
                                    sendWhatsAppFn={
                                        sendRetentionWhatsApp.bind(null, event.id, team.id) } />
            </Paper>
        </>
    )
}

export const generateMetadata = generateEventMetadataFn('Retention');
