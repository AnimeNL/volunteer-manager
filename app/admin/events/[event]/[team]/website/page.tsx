// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import LanguageIcon from '@mui/icons-material/Language';

import { OverviewTiles } from '@app/admin/components/OverviewTiles';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEventAndTeam }
    from '../../requireAuthenticationContextWithEventAndTeam';

/**
 * Overview page for managing an event's settings.
 */
export default async function EventTeamWebsitePage(
    props: PageProps<'/admin/events/[event]/[team]/website'>)
{
    const { event, team } = await requireAuthenticationContextWithEventAndTeam(props);
    return (
        <>
            <Section icon={ <LanguageIcon color="primary" /> } title="Website"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: 'Website' },
                     ]}>
                <SectionIntroduction>
                    Website management for {team.domain}.
                </SectionIntroduction>
            </Section>
            <OverviewTiles layout />
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Website', { team: 'team' }, { event: 'event' });
