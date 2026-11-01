// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TrainingConfiguration } from '../TrainingConfiguration';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * The <EventTrainingSettingsPage> page allows event administrators to configure available training
 * sessions and preference windows for a particular event.
 */
export default async function EventTrainingSettingsPage(
    props: PageProps<'/admin/events/[event]/training/settings'>)
{
    const { event } = await requireAuthenticationWithEvent(props, 'event.trainings');
    if (!event.flags.enableTraining)
        notFound();

    return (
        <>
            <Section icon={ <SettingsSuggestIcon color="primary" /> } title="Training settings"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Trainings', href: `/admin/events/${event.slug}/training` },
                         { label: 'Settings' },
                     ]}>
                <SectionIntroduction>
                    Settings regarding the training session and preference availability for{' '}
                    {event.shortName}.
                </SectionIntroduction>
            </Section>
            <TrainingConfiguration event={event} />
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Settings', 'Trainings', { event: 'event' });
