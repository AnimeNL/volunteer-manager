// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import CategoryIcon from '@mui/icons-material/Category';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { ShiftCategoriesTable } from './ShiftCategoriesTable';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';

/**
 * The shift categories page allows administrators to modify the categories in which shifts can be
 * created. The category defines the shift's colour—chromatic colours can be calculated.
 */
export default async function EventTeamShiftCategoriesPage(
    props: PageProps<'/admin/events/[event]/[team]/shifts/categories'>)
{
    const { event, team } = await requireAuthenticationWithEventAndTeam(props, {
        permission: 'event.shift-categories',
    });

    return (
        <>
            <Section icon={ <CategoryIcon color="primary" /> } title="Shift categories"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: 'Shifts', href: `/admin/events/${event.slug}/${team.slug}/shifts` },
                         { label: 'Categories' },
                     ]}>
                <SectionIntroduction important>
                    Shift categories are shared across all events and teams, they define the visual
                    identity of each shift in scheduling.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <ShiftCategoriesTable />
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Shift categories', { team: 'team' }, { event: 'event' });
