// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEvent } from '../../requireAuthenticationContextWithEvent';

/**
 * Page displaying the settings for ticket management during this event. Information will be fetched
 * from the Ticket library, which abstracts over the supported ticket providers.
 */
export default async function EventTicketsSettingsPage(
    props: PageProps<'/admin/events/[event]/tickets/settings'>)
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
            <Section icon={ <SettingsOutlinedIcon color="primary" /> } title="Ticket settings"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        { label: 'Settings' },
                     ]}>
                <SectionIntroduction>
                    Settings regarding ticket management for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                todo
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Settings', 'Tickets', { event: 'event' });
