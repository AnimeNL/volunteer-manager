// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import Grid from '@mui/material/Grid';

import { AvailabilityToggle } from '@app/admin/components/AvailabilityToggle';
import { AvailabilityWindow } from '@app/admin/components/AvailabilityWindow';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { RefundsHeader } from './RefundsHeader';
import { RefundsTable } from './RefundsTable';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { executeServerAction } from '@lib/serverAction';
import { generateEventMetadataFn } from '../generateEventMetadataFn';
import { getEventNameForId } from '@lib/EventLoader';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tEvents } from '@lib/database';

import { kTemporalZonedDateTime } from '@app/api/Types';

/**
 * The data associated with a hotel configuration update.
 */
const kRefundConfigurationData = z.object({
    /**
     * Whether refund information should be published on the registration portal.
     */
    refundInformationPublished: z.coerce.number(),

    /**
     * Moment in time, if any, at which we'll start to accept refund requests.
     */
    refundRequestsStart: kTemporalZonedDateTime.nullish(),

    /**
     * Moment in time, if any, at which we'll no longer accept refund requests.
     */
    refundRequestsEnd: kTemporalZonedDateTime.nullish(),
});

/**
 * Server Action that will be invoked when the refund configuration is being updated by a senior
 * volunteer. Synchronises the state update request with the database.
 */
async function updateRefundConfiguration(eventId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kRefundConfigurationData, async (data, props) => {
        await db.update(tEvents)
            .set({
                refundInformationPublished: data.refundInformationPublished,
                refundRequestsStart: data.refundRequestsStart,
                refundRequestsEnd: data.refundRequestsEnd,
            })
            .where(tEvents.eventId.equals(eventId))
            .executeUpdate();

        RecordLog({
            type: kLogType.AdminEventPublishInfo,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                event: await getEventNameForId(eventId),
                published: !!data.refundInformationPublished,
                type: 'refund',
            },
        });
    });
}

/**
 * The <EventRefundsPage> page allows select volunteers who are both event administrators and have
 * access to the volunteering refunds to see the overview of requested refunds for a given event.
 */
export default async function EventRefundsPage(props: PageProps<'/admin/events/[event]/refunds'>) {
    const params = await props.params;

    const { access, event } = await verifyAccessAndFetchPageInfo(props.params, {
        permission: 'event.refunds',
        scope: {
            event: params.event,
        },
    });

    // If refund management has not been enabled for this event, the page is not accessible.
    if (!event.refundEnabled)
        notFound();

    const enableExport = access.can('organisation.exports');

    // ---------------------------------------------------------------------------------------------

    const dbInstance = db;
    const defaultValues = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventId.equals(event.id))
        .select({
            refundInformationPublished: tEvents.refundInformationPublished,
            refundRequestsStart: dbInstance.dateTimeAsString(tEvents.refundRequestsStart),
            refundRequestsEnd: dbInstance.dateTimeAsString(tEvents.refundRequestsEnd),
        })
        .projectingOptionalValuesAsNullable()
        .executeSelectNoneOrOne() ?? undefined;

    const action = updateRefundConfiguration.bind(null, event.id);

    return (
        <>
            <RefundsHeader enableExport={enableExport} event={event} />
            <FormGridSection action={action} defaultValues={defaultValues} noHeader>
                <Grid size={{ xs: 12 }}>
                    <SectionIntroduction>
                        This section enables you to set the timeframe for accepting refund requests,
                        and to decide if this information should be publicly available.
                    </SectionIntroduction>
                </Grid>
                <AvailabilityToggle label="Publish information" name="refundInformationPublished" />
                <AvailabilityWindow label="Accept requests" start="refundRequestsStart"
                                    end="refundRequestsEnd" timezone={event.timezone} />
            </FormGridSection>
            <RefundsTable event={event.slug} />
        </>
    );
}

export const generateMetadata = generateEventMetadataFn('Refunds');
