// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import db, { tUsers, tUsersEvents } from '@lib/database';

import { ActionBar } from '@app/admin/components/ActionBar';
import { ContactVolunteerSection } from './ContactVolunteerSection';
import { VolunteerQuickActions } from './VolunteerQuickActions';

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

    const dbInstance = db;
    const volunteer = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.userId.equals(id))
            .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
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
                        <VolunteerQuickActions firstName={volunteer.firstName}
                                               cancelFn={cancelFn}
                                               reinstateFn={reinstateFn}
                                               changeRoleFn={changeRoleFn}
                                               changeTeamFn={changeTeamFn}
                                               manageOverrides={volunteer.overrides}
                                               manageOverridesFn={manageOverridesFn} />
                    </ActionBar> }
            </Section>

            { /* TODO: Identity w/ notes */ }

            { /* TODO: Status tiles */ }

            { /* TODO: Schedule */ }

            <ContactVolunteerSection event={event.id} team={team.id} user={{
                id: volunteer.id,
                name: volunteer.name,
            }} />

        </>
    );
}
