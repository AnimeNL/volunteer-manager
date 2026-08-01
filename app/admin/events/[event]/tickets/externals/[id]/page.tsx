// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEvent } from '../../../requireAuthenticationContextWithEvent';

/**
 * Page that provides insight in the ticket granted to an individual external to our team.
 */
export default async function EventTicketsExternalPage(
    props: PageProps<'/admin/events/[event]/tickets/externals/[id]'>)
{
    const { event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'event.tickets',
        operation: 'read',
    });

    const external = {
        name: 'John Doe',
    };

    return (
        <>
            <Section icon={ <LocalActivityOutlinedIcon color="primary" /> } title="Tickets"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        {
                            label: 'Externals',
                            href: `/admin/events/${event.slug}/tickets/externals`,
                        },
                        { label: external.name },
                     ]}>
                <SectionIntroduction>
                    Information about the ticket issued to {external.name} for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                todo
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id', prefix: 'Ticket #' }, 'Externals',
                             'Tickets', { event: 'event' });
