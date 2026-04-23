// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { AvailabilityWindow } from '@app/admin/components/AvailabilityWindow';
import { FormGrid } from '@app/admin/components/FormGrid';
import { generateEventMetadataFn } from '../../../generateEventMetadataFn';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tEnvironmentsEvents } from '@lib/database';

import * as actions from '../WebsiteActions';

/**
 * The <EventWebsiteSettingsPage> page allows settings relating to the website to be changed, such
 * as availability and timelines.
 */
export default async function EventWebsiteSettingsPage(
    props: PageProps<'/admin/events/[event]/[team]/website/settings'>)
{
    const { event, team } = await verifyAccessAndFetchPageInfo(props.params);
    if (!team.flagManagesContent)
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
        <FormGrid action={action} defaultValues={defaultValues} timezone={event.timezone}>
            <AvailabilityWindow label="Accept applications" timezone={event.timezone}
                                start="acceptApplicationsStart" end="acceptApplicationsEnd" />
            <AvailabilityWindow label="Publish content" timezone={event.timezone}
                                start="publishContentStart" end="publishContentEnd" />
            <AvailabilityWindow label="Publish portal" timezone={event.timezone}
                                start="publishPortalStart" end="publishPortalEnd" />
        </FormGrid>
    );
}

export const generateMetadata = generateEventMetadataFn('Website settings');
