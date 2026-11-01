// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import HistoryEduIcon from '@mui/icons-material/HistoryEdu';

import { OverviewTiles } from '@app/admin/components/OverviewTiles';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * The <EventTrainingPage> page is the overview page for training management of a particular event.
 */
export default async function EventTrainingPage(
    props: PageProps<'/admin/events/[event]/training'>)
{
    const { event } = await requireAuthenticationWithEvent(props, 'event.trainings');
    if (!event.flags.enableTraining)
        notFound();

    return (
        <>
            <Section icon={ <HistoryEduIcon color="primary" /> } title="Trainings"
                     documentation="event/training"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Trainings' },
                     ]}>
                <SectionIntroduction>
                    Training session assignments and settings for {event.shortName} volunteers.
                </SectionIntroduction>
            </Section>
            <OverviewTiles layout />
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Trainings', { event: 'event' });
