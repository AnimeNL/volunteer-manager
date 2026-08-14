// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';

import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Section } from '@app/admin/components/Section';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEventAndTeam } from '../../../../requireAuthenticationContextWithEventAndTeam';
import db, { tUsersEvents, tUsers } from '@lib/database';

/**
 * Page that visualises, and for some, makes managable the preferences that the volunteer has shared
 * for the current event. Each kind of preference maintains a "changelog".
 */
export default async function EventTeamVolunteerPreferencesPage(
    props: PageProps<'/admin/events/[event]/[team]/volunteers/[volunteer]/preferences'>)
{
    const { event, team } = await requireAuthenticationContextWithEventAndTeam(props, {
        permission: 'event.vendors',
        operation: 'read',
    });

    const id = (await props.params).volunteer;

    const context = await db.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.teamId.equals(team.id))
            .and(tUsersEvents.userId.equals(parseInt(id, /* radix= */ 10)))
            .and(tUsersEvents.registrationStatus.in([ 'Accepted', 'Cancelled' ]))
        .select({
            volunteer: {
                id: tUsers.userId,
                name: tUsers.name,
            },
        })
        .executeSelectNoneOrOne();
    
    if (!context)
        notFound();

    const { volunteer } = context;

    return (
        <>
            <Section icon={ <OutboxOutlinedIcon color="primary" /> } title="Communication"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         {
                             label: 'Volunteers',
                             href: `/admin/events/${event.slug}/${team.slug}/volunteers`,
                         },
                         {
                             label: volunteer.name,
                             href: `/admin/events/${event.slug}/${team.slug}/volunteers/${id}`,
                         },
                         { label: 'Communication' },
                     ]}>
                <SectionIntroduction>
                    Messages we've sent {volunteer.name} regarding their participation in{' '}
                    {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                TODO
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Communication', { user: 'volunteer' }, 'Volunteers', { team: 'team' }, { event: 'event' });
