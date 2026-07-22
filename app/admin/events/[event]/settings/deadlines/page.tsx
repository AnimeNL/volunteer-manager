// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import EditCalendarIcon from '@mui/icons-material/EditCalendar';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEvent } from '../../requireAuthenticationContextWithEvent';

/**
 * Page through which the important dates for a particular event can be configured.
 */
export default async function EventSettingsDeadlinesPage(
    props: PageProps<'/admin/events/[event]/settings/deadlines'>)
{
    const { event } = await requireAuthenticationContextWithEvent(props);
    return (
        <>
            <Section icon={ <EditCalendarIcon color="primary" /> } title="Important dates"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Settings', href: `/admin/events/${event.slug}/settings` },
                        { label: 'Important dates' },
                     ]}>
                <SectionIntroduction>
                    Important deadlines and highlights during {event.shortName} organisation.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                todo
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Important dates', 'Settings', { event: 'event' });
