// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import GroupsIcon from '@mui/icons-material/Groups';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEvent } from '../../requireAuthenticationContextWithEvent';

/**
 * Page through which the teams associated with a given event can be configured.
 */
export default async function EventSettingsTeamsPage(
    props: PageProps<'/admin/events/[event]/settings/teams'>)
{
    const { event } = await requireAuthenticationContextWithEvent(props);
    return (
        <>
            <Section icon={ <GroupsIcon color="primary" /> } title="Participating teams"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Settings', href: `/admin/events/${event.slug}/settings` },
                        { label: 'Participating teams' },
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
    createGenerateMetadataFn('Participating teams', 'Settings', { event: 'event' });
