// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';

import { ActionBar } from '@app/admin/components/ActionBar';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { VolunteerChangeRoleQuickAction } from './VolunteerChangeRoleQuickAction';
import { VolunteerChangeTeamQuickAction } from './VolunteerChangeTeamQuickAction';
import { VolunteerContactSection } from './VolunteerContactSection';
import { VolunteerIdentitySection } from './VolunteerIdentitySection';
import { VolunteerQuickActions } from './VolunteerQuickActions';
import { getBlobUrl } from '@lib/database/BlobStore';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import db, { tEvents, tEventsTeams, tRoles, tStorage, tTeams, tTeamsRoles, tUsers, tUsersEvents }
    from '@lib/database';

import * as actions from './VolunteerActions';

/**
 * Page displaying the basic information and metadata associated with a volunteer.
 */
export default async function EventTeamVolunteerPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers/[volunteer]'>)
{
    const { access, event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'event.volunteers.information',
        operation: 'read',
    });

    const id = parseInt((await props.params).volunteer, /* radix= */ 10);

    // ---------------------------------------------------------------------------------------------

    const storageJoin = tStorage.forUseInLeftJoin();

    const dbInstance = db;
    const volunteer = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .leftJoin(storageJoin)
            .on(storageJoin.fileId.equals(tUsers.avatarId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.userId.equals(id))
            .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
            avatarHash: storageJoin.fileHash,
            email: tUsers.username,
            language: tUsers.language,
            notes: tUsersEvents.registrationNotes,
            phoneNumber: tUsers.phoneNumber,
            role: tRoles.roleName,
            roleId: tUsersEvents.roleId,
            status: tUsersEvents.registrationStatus,

            overrides: {
                timeslotLimit: tUsersEvents.availabilityEventLimit,
                hotelEligible: tUsersEvents.hotelEligible,
                trainingEligible: tUsersEvents.trainingEligible,
            },
        })
        .executeSelectNoneOrOne();

    if (!volunteer)
        notFound();

    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const teams = await dbInstance.selectFrom(tEvents)
        .innerJoin(tEventsTeams)
            .on(tEventsTeams.eventId.equals(tEvents.eventId))
                .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tEventsTeams.teamId))
        .innerJoin(tTeamsRoles)
            .on(tTeamsRoles.teamId.equals(tTeams.teamId))
                .and(tTeamsRoles.roleDefault.equals(/* true= */ 1))
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.eventId.equals(tEvents.eventId))
                .and(usersEventsJoin.teamId.equals(tEventsTeams.teamId))
                .and(usersEventsJoin.userId.equals(id))
        .where(tEvents.eventId.equals(event.id))
        .select({
            id: tTeams.teamId,
            colour: tTeams.teamColourLightTheme,
            name: tTeams.teamName,
            slug: tTeams.teamSlug,
            status: usersEventsJoin.registrationStatus,
        })
        .orderBy(tTeams.teamName, 'asc')
        .executeSelectMany();

    const roles = await dbInstance.selectFrom(tTeamsRoles)
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tTeamsRoles.roleId))
        .where(tTeamsRoles.teamId.equals(team.id))
        .select({
            id: tRoles.roleId,
            label: tRoles.roleName,
            privilegeWarning: tRoles.rolePermissionGrant.isNotNull(),
        })
        .orderBy(tRoles.roleOrder, 'asc')
        .executeSelectMany();

    const accountLink = access.can('organisation.accounts', 'read')
        ? `/admin/organisation/accounts/${volunteer.id}`
        : undefined;

    const accessScope = { event: event.slug, team: team.slug };

    const canUpdateApplications = access.can('event.applications', 'update', accessScope);
    const canUpdateOverrides = access.can('event.volunteers.overrides', accessScope);
    const canUpdateVolunteer = access.can('event.volunteers.information', 'update', accessScope);

    const canDoAnything = canUpdateApplications || canUpdateOverrides || canUpdateVolunteer;

    const cancelFn = (canUpdateApplications && volunteer.status !== 'Cancelled')
        ? actions.cancelParticipation.bind(null, volunteer.id, event.slug, team.slug)
        : undefined!;

    const reinstateFn = (canUpdateApplications && volunteer.status !== 'Accepted')
        ? actions.reinstateParticipation.bind(null, volunteer.id, event.slug, team.slug)
        : undefined!;

    const changeRoleFn = canUpdateVolunteer
        ? actions.changeRole.bind(null, volunteer.id, event.slug, team.slug)
        : undefined!;

    const changeTeamFn = canUpdateVolunteer
        ? actions.changeTeam.bind(null, volunteer.id, event.slug, team.slug)
        : undefined!;

    const manageOverridesFn = canUpdateOverrides
        ? actions.updateOverrides.bind(null, volunteer.id, event.slug, team.slug)
        : undefined!;

    const updateNotesFn = canUpdateVolunteer
        ? actions.updateNotes.bind(null, volunteer.id, event.slug, team.slug)
        : undefined!;

    return (
        <>
            <Section icon={ <PersonOutlinedIcon color="primary" /> } title={volunteer.name}
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         {
                             label: 'Volunteers',
                             href: `/admin/events/${event.slug}/${team.slug}/volunteers`,
                         },
                         { label: volunteer.name },
                     ]}>
                <SectionIntroduction>
                    Overview of {volunteer.name}'s participation in {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                { !canDoAnything &&
                    <Alert severity="warning" variant="outlined">
                        You do not have permission to make changes to this volunteer. Contact a
                        Staff member for assistance if you need to.
                    </Alert> }
                { !!canDoAnything &&
                    <ActionBar>
                        { !!changeRoleFn &&
                            <VolunteerChangeRoleQuickAction action={changeRoleFn}
                                                            currentRole={volunteer.roleId}
                                                            firstName={volunteer.firstName}
                                                            roles={roles} /> }
                        { !!changeTeamFn &&
                            <VolunteerChangeTeamQuickAction action={changeTeamFn}
                                                            currentTeamId={team.id}
                                                            eventId={event.id}
                                                            teams={teams}
                                                            volunteer={volunteer} /> }
                        <VolunteerQuickActions firstName={volunteer.firstName}
                                               cancelFn={cancelFn}
                                               reinstateFn={reinstateFn}
                                               manageOverrides={volunteer.overrides}
                                               manageOverridesFn={manageOverridesFn} />
                    </ActionBar> }
            </Section>

            <VolunteerIdentitySection action={updateNotesFn} notes={volunteer.notes}
                                      details={{
                                          accountLink,
                                          avatar: getBlobUrl(volunteer.avatarHash),
                                          email: volunteer.email,
                                          name: volunteer.name,
                                          phoneNumber: volunteer.phoneNumber,
                                          role: volunteer.role,
                                      }} />

            <VolunteerContactSection event={event.id} team={team.id} user={{
                id: volunteer.id,
                name: volunteer.name,
            }} />

            { /* TODO: Status tiles */ }

            { /* TODO: Schedule */ }

        </>
    );
}
