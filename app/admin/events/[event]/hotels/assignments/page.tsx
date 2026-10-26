// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import HotelIcon from '@mui/icons-material/Hotel';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * The <EventHotelAssignmentsPage> page allows event administrators to view and manage hotel room
 * assignments for volunteers participating in a particular event.
 */
export default async function EventHotelAssignmentsPage(
    props: PageProps<'/admin/events/[event]/hotels/assignments'>)
{
    const { event } = await requireAuthenticationWithEvent(props, 'event.hotels');
    if (!event.flags.enableHotel)
        notFound();

    return (
        <>
            <Section icon={ <HotelIcon color="primary" /> } title="Hotel assignments"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Hotels', href: `/admin/events/${event.slug}/hotels` },
                         { label: 'Assignments' },
                     ]}>
                <SectionIntroduction>
                    Hotel room assignments and pending requests for {event.shortName} volunteers.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                TODO
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Assignments', 'Hotels', { event: 'event' });
