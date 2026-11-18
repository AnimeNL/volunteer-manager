// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import LocalActivityIcon from '@mui/icons-material/LocalActivity';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * Page through which ticketing settings for a particular event can be configured.
 */
export default async function EventSettingsTicketingPage(
    props: PageProps<'/admin/events/[event]/settings/ticketing'>)
{
    const { event } = await requireAuthenticationWithEvent(props, 'event.settings');
    return (
        <Section icon={ <LocalActivityIcon color="primary" /> } title="Ticketing"
                 breadcrumbs={[
                     { label: event.shortName, href: `/admin/events/${event.slug}` },
                     { label: 'Settings', href: `/admin/events/${event.slug}/settings` },
                     { label: 'Ticketing' },
                 ]}>
            <SectionIntroduction>
                Ticketing configuration for {event.shortName}.
            </SectionIntroduction>
        </Section>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Ticketing', 'Settings', { event: 'event' });
