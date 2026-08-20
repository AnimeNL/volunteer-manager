// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';
import db, { tUsers, tUsersEvents } from '@lib/database';

import { ActionBar } from '@app/admin/components/ActionBar';
import { ContactVolunteerSection } from './ContactVolunteerSection';

/**
 * Page displaying the basic information and metadata associated with a volunteer.
 */
export default async function EventTeamVolunteerPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers/[volunteer]'>)
{
    const { event, team } = await requireAuthenticationWithEventAndTeam(props, {
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
        })
        .executeSelectNoneOrOne();

    if (!volunteer)
        notFound();

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
                <ActionBar>
                    { /* TODO: Cancel participation */ }
                    { /* TODO: Reinstate participation */ }
                    { /* TODO: Change role */ }
                    { /* TODO: Change team */ }
                    { /* TODO: Manage overrides */ }
                </ActionBar>
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
