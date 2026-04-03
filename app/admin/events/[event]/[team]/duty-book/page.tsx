// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { Section } from '@app/admin/components/Section';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { readSetting } from '@lib/Settings';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';

/**
 * The Duty Book is the place where volunteers log information about incidents that happens during
 * the festival, so that others are aware of the specifics and/or the associated pictures.
 */
export default async function EventTeamDutyBookPage(
    props: PageProps<'/admin/events/[event]/[team]/duty-book'>)
{
    const { event, team } = await verifyAccessAndFetchPageInfo(props.params);

    const dutyBookEnabled = await readSetting('schedule-duty-book');
    if (!dutyBookEnabled || !team.flagEnableDutyBook)
        notFound();

    return (
        <Section title="Duty book" subtitle={event.shortName}>
            <SectionIntroduction>
                The duty book lists all reported incidents during this festival. The information
                can be consumed in the portal as well.
            </SectionIntroduction>
            { /* TODO: Implement something */ }
        </Section>
    );
}

export const generateMetadata = generateEventMetadataFn('Duty book');
