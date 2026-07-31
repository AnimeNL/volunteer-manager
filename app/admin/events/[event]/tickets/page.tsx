// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';

import { OverviewTiles } from '@app/admin/components/OverviewTiles';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEvent } from '../requireAuthenticationContextWithEvent';

/**
 * Overview page for the event ticket management tooling.
 */
export default async function EventTicketsPage(
    props: PageProps<'/admin/events/[event]/tickets'>)
{
    const params = await props.params;
    const { event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'event.tickets',
        operation: 'read',
        scope: {
            event: params.event,
        },
    });

    return (
        <>
            <Section icon={ <LocalActivityOutlinedIcon color="primary" /> } title="Tickets"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets' },
                     ]}>
                <SectionIntroduction>
                    Tools to manage festival tickets for {event.shortName} volunteers.
                </SectionIntroduction>
            </Section>
            <OverviewTiles layout />
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Tickets', { event: 'event' });
