// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import EventNoteIcon from '@mui/icons-material/EventNote';

import { OverviewTiles } from '@app/admin/components/OverviewTiles';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * The <ProgramPage> component is the main overview page of a festival's program.
 */
export default async function ProgramPage(props: PageProps<'/admin/events/[event]/program'>) {
    const { event } = await requireAuthenticationWithEvent(props);
    if (!event.integrations?.anPlanFestivalId)
        notFound();

    return (
        <>
            <Section icon={ <EventNoteIcon color="primary" /> } title="Program"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Program' },
                     ]}>
                <SectionIntroduction>
                    Program information for {event.shortName}, synchronized from AnPlan.
                </SectionIntroduction>
            </Section>
            <OverviewTiles layout />
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Program', { event: 'event' });
