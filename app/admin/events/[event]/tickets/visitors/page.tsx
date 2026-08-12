// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import PublicIcon from '@mui/icons-material/Public';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEvent } from '../../requireAuthenticationContextWithEvent';

/**
 * Page that
 */
export default async function EventTicketsVisitorsPage(
    props: PageProps<'/admin/events/[event]/tickets/visitors'>)
{
    const { access, event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'event.tickets',
        operation: 'read',
    });

    return (
        <>
            <Section icon={ <PublicIcon color="primary" /> }
                     title="Visitor tickets"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        { label: 'Visitors' },
                     ]}>
                <SectionIntroduction>
                    Overview of all tickets that were purchased for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                xx
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Visitors', 'Tickets', { event: 'event' });
