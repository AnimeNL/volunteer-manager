// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { RetentionDataTable } from './RetentionDataTable';
import { RetentionOutreachList } from './RetentionOutreachList';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { getLeadersForEvent } from '@app/admin/lib/getLeadersForEvent';
import { readSetting } from '@lib/Settings';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tRetention, tUsersEvents, tUsers } from '@lib/database';

import { kRetentionStatus } from '@lib/database/Types';

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

    const whatsAppLink = `https://${team._environment}/registration`;
    const whatsAppMessage = await readSetting('retention-whatsapp-message') ?? '{name}, {link}?!';

    return (
        <>
            <Collapse in={!!assignedVolunteers.length} unmountOnExit>
                <RetentionOutreachList assignedVolunteers={assignedVolunteers} />
            </Collapse>
            <Paper sx={{ p: 2 }}>
                <Typography variant="h5">
                    {team.name.replace(/s$/, '')} retention
                    <Typography component="span" variant="h5" color="action.active" sx={{ pl: 1 }}>
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
                                    event={event.slug} leaders={leaders} team={team.slug} />
            </Paper>
        </>
    )
}

export const generateMetadata = generateEventMetadataFn('Retention');
