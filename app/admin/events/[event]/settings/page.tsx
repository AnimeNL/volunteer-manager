// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import { OverviewTiles } from '@app/admin/components/OverviewTiles';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEvent } from '../requireAuthenticationContextWithEvent';

/**
 * Overview page for managing an event's settings.
 */
export default async function EventSettingsPage(
    props: PageProps<'/admin/events/[event]/settings'>)
{
    const { event } = await requireAuthenticationContextWithEvent(props, 'event.settings');
    return (
        <>
            <Section icon={ <SettingsOutlinedIcon color="primary" /> } title="Settings"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Settings' },
                     ]}>
                <SectionIntroduction>
                    Settings related to {event.shortName} in the Volunteer Manager.
                </SectionIntroduction>
            </Section>
            <OverviewTiles layout />
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Settings', { event: 'event' });
