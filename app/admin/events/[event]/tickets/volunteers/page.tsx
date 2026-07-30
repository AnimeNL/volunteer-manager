// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEvent } from '../../requireAuthenticationContextWithEvent';

/**
 * Page that provides an overview of all volunteers confirmed to help out during a particular event,
 * and whether a ticket has been granted to them already.
 */
export default async function EventTicketsVolunteersPage(
    props: PageProps<'/admin/events/[event]/tickets/volunteers'>)
{
    const params = await props.params;
    const { event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'event.settings',
        scope: {
            event: params.event,
        },
    });

    return (
        <>
            <Section icon={ <LocalActivityOutlinedIcon color="primary" /> } title="Tickets"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        { label: 'Volunteers' },
                     ]}>
                <SectionIntroduction>
                    Overview of the tickets granted to the volunteers of {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                todo
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Volunteers', 'Tickets', { event: 'event' });
