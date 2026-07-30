// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEvent } from '../../../requireAuthenticationContextWithEvent';
import db, { tUsers, tUsersEvents } from '@lib/database';

/**
 * Page that provides insight in the ticket granted for an individual volunteer. It provides options
 * to (re)issue the ticket, or to revoke it with a given reason.
 */
export default async function EventTicketsVolunteerPage(
    props: PageProps<'/admin/events/[event]/tickets/volunteers/[id]'>)
{
    const params = await props.params;
    const { event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'event.settings',
        scope: {
            event: params.event,
        },
    });

    const dbInstance = db;
    const participation = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.userId.equals(parseInt(params.id, /* radix= */ 10)))
        .select({
            events: dbInstance.aggregateAsArray({

            }),
            user: {
                name: tUsers.name,
            },
        })
        .groupBy(tUsersEvents.userId)
        .executeSelectNoneOrOne();

    if (!participation)
        notFound();

    return (
        <>
            <Section icon={ <LocalActivityOutlinedIcon color="primary" /> } title="Tickets"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        {
                            label: 'Volunteers',
                            href: `/admin/events/${event.slug}/tickets/volunteers`,
                        },
                        { label: participation.user.name },
                     ]}>
                <SectionIntroduction>
                    Information about any tickets issued to {participation.user.name} for{' '}
                    {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                todo
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ user: 'id' }, 'Volunteers', 'Tickets', { event: 'event' });
