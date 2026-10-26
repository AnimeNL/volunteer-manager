// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import HotelIcon from '@mui/icons-material/Hotel';

import { OverviewTiles } from '@app/admin/components/OverviewTiles';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * The <EventHotelsPage> page is the overview page for hotel room management of a particular event.
 */
export default async function EventHotelsPage(props: PageProps<'/admin/events/[event]/hotels'>) {
    const { event } = await requireAuthenticationWithEvent(props, 'event.hotels');
    if (!event.flags.enableHotel)
        notFound();

    return (
        <>
            <Section icon={ <HotelIcon color="primary" /> } title="Hotels"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Hotels' },
                     ]}>
                <SectionIntroduction>
                    Hotel room assignments and settings for {event.shortName} volunteers.
                </SectionIntroduction>
            </Section>
            <OverviewTiles layout />
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Hotels', { event: 'event' });
