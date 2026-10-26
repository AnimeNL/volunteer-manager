// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * The <EventHotelSettingsPage> page allows event administrators to configure available hotel room
 * options and preference windows for a particular event.
 */
export default async function EventHotelSettingsPage(
    props: PageProps<'/admin/events/[event]/hotels/settings'>)
{
    const { event } = await requireAuthenticationWithEvent(props, 'event.hotels');
    if (!event.flags.enableHotel)
        notFound();

    return (
        <>
            <Section icon={ <SettingsSuggestIcon color="primary" /> } title="Hotel settings"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Hotels', href: `/admin/events/${event.slug}/hotels` },
                         { label: 'Settings' },
                     ]}>
                <SectionIntroduction>
                    Settings regarding the hotel room and preference availability for{' '}
                    {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                TODO
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Settings', 'Hotels', { event: 'event' });
