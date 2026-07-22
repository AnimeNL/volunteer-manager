// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEvent } from '../../requireAuthenticationContextWithEvent';

/**
 * Page through which the primary configuration associated with a particular event can be adjusted.
 */
export default async function EventSettingsTeamsPage(
    props: PageProps<'/admin/events/[event]/settings/configuration'>)
{
    const { event } = await requireAuthenticationContextWithEvent(props);
    return (
        <>
            <Section icon={ <SettingsSuggestIcon color="primary" /> } title="Configuration"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Settings', href: `/admin/events/${event.slug}/settings` },
                        { label: 'Configuration' },
                     ]}>
                <SectionIntroduction>
                    Settings regarding the teams that are participating in {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                todo
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Configuration', 'Settings', { event: 'event' });
