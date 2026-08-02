// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';

import { AvailabilityWindow } from '@app/admin/components/AvailabilityWindow';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEventAndTeam }
    from '../../../requireAuthenticationContextWithEventAndTeam';
import db, { tEnvironmentsEvents } from '@lib/database';

import * as actions from '../WebsiteActions';

/**
 * The <EventTeamWebsiteSettingsPage> page allows settings relating to the website to be changed.
 */
export default async function EventTeamWebsiteSettingsPage(
    props: PageProps<'/admin/events/[event]/[team]/website/settings'>)
{
    const { event, team } = await requireAuthenticationContextWithEventAndTeam(props);
    if (!team.flags.managesContent)
        notFound();

    const dbInstance = db;

    const action = actions.updateSettings.bind(null, event.id, team.environmentId);
    const defaultValues = await dbInstance.selectFrom(tEnvironmentsEvents)
        .where(tEnvironmentsEvents.eventId.equals(event.id))
            .and(tEnvironmentsEvents.environmentId.equals(team.environmentId))
        .select({
            acceptApplicationsStart:
                dbInstance.dateTimeAsString(tEnvironmentsEvents.environmentAcceptApplicationsStart),
            acceptApplicationsEnd:
                dbInstance.dateTimeAsString(tEnvironmentsEvents.environmentAcceptApplicationsEnd),
            publishContentStart:
                dbInstance.dateTimeAsString(tEnvironmentsEvents.environmentPublishContentStart),
            publishContentEnd:
                dbInstance.dateTimeAsString(tEnvironmentsEvents.environmentPublishContentEnd),
            publishPortalStart:
                dbInstance.dateTimeAsString(tEnvironmentsEvents.environmentPublishPortalStart),
            publishPortalEnd:
                dbInstance.dateTimeAsString(tEnvironmentsEvents.environmentPublishPortalEnd),
        })
        .executeSelectNoneOrOne() ?? undefined;

    return (
        <>
            <Section icon={ <SettingsSuggestIcon color="primary" /> } title="Settings"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         {
                             label: 'Website',
                             href: `/admin/events/${event.slug}/${team.slug}/website`,
                         },
                         { label: 'Settings' },
                     ]}>
                <SectionIntroduction>
                    Configuration settings for{' '}
                    <MuiLink component={Link} target="_blank"
                             href={`https://${team.domain}/registration/${event.slug}`}>
                        {team.domain}
                    </MuiLink> in scope of {event.shortName}.
                </SectionIntroduction>
            </Section>
            <FormGridSection noHeader tabs action={action} defaultValues={defaultValues}
                             timezone={event.timeZone}>
                <AvailabilityWindow label="Accept applications" timezone={event.timeZone}
                                    start="acceptApplicationsStart" end="acceptApplicationsEnd" />
                <AvailabilityWindow label="Publish content" timezone={event.timeZone}
                                    start="publishContentStart" end="publishContentEnd" />
                <AvailabilityWindow label="Publish portal" timezone={event.timeZone}
                                    start="publishPortalStart" end="publishPortalEnd" />
            </FormGridSection>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Settings', 'Website', { team: 'team' }, { event: 'event' });
