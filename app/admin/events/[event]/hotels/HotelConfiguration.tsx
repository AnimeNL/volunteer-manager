// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

import { AvailabilityToggle } from '@app/admin/components/AvailabilityToggle';
import { AvailabilityWindow } from '@app/admin/components/AvailabilityWindow';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { HotelConfigurationTable } from './HotelConfigurationTable';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { executeServerAction } from '@lib/serverAction';
import { getEventNameForId } from '@lib/EventLoader';
import db, { tEvents } from '@lib/database';

import { kTemporalZonedDateTime } from '@app/api/Types';

/**
 * The data associated with a hotel configuration update.
 */
const kHotelConfigurationData = z.object({
    /**
     * Whether hotel information should be published on the registration portal.
     */
    hotelInformationPublished: z.coerce.number(),

    /**
     * Moment in time, if any, at which we'll start to accept hotel room preferences.
     */
    hotelPreferencesStart: kTemporalZonedDateTime.nullish(),

    /**
     * Moment in time, if any, at which applications will no longer accept hotel room preferences.
     */
    hotelPreferencesEnd: kTemporalZonedDateTime.nullish(),
});

/**
 * Server Action that will be invoked when the hotel configuration is being updated by a senior
 * volunteer. Synchronises the state update request with the database.
 */
async function updateHotelConfiguration(eventId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kHotelConfigurationData, async (data, props) => {
        await db.update(tEvents)
            .set({
                hotelInformationPublished: data.hotelInformationPublished,
                hotelPreferencesStart: data.hotelPreferencesStart,
                hotelPreferencesEnd: data.hotelPreferencesEnd,
            })
            .where(tEvents.eventId.equals(eventId))
            .executeUpdate();

        RecordLog({
            type: kLogType.AdminEventPublishInfo,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                event: await getEventNameForId(eventId),
                published: !!data.hotelInformationPublished,
                type: 'hotel',
            },
        });
    });
}

/**
 * Props accepted by the <HotelConfiguration> component.
 */
interface HotelConfigurationProps {
    /**
     * Information about the event for which hotel rooms are being shown.
     */
    event: {
        id: number;
        slug: string;
        timezone: string;
    };
}

/**
 * The <HotelConfiguration> component allows event administrators to add or remove hotel and hotel
 * rooms to settings. Changes will be reflected on the volunteer portal immediately.
 */
export async function HotelConfiguration(props: HotelConfigurationProps) {
    const action = updateHotelConfiguration.bind(null, props.event.id);

    const dbInstance = db;
    const configuration = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventId.equals(props.event.id))
        .select({
            hotelInformationPublished: tEvents.hotelInformationPublished,
            hotelPreferencesStart: dbInstance.dateTimeAsString(tEvents.hotelPreferencesStart),
            hotelPreferencesEnd: dbInstance.dateTimeAsString(tEvents.hotelPreferencesEnd),
        })
        .projectingOptionalValuesAsNullable()
        .executeSelectNoneOrOne() ?? undefined;

    return (
        <FormGridSection action={action} defaultValues={configuration}
                         timezone={props.event.timezone} title="Hotel room configuration">
            <Grid size={{ xs: 12 }}>
                <SectionIntroduction>
                    This section allows you to specify which hotel rooms are available, and to
                    decide whether this information should be publicly accessible. Additionally, you
                    can set the time frame during which volunteers can share their room preferences.
                </SectionIntroduction>
            </Grid>
            <AvailabilityToggle label="Publish information" name="hotelInformationPublished" />
            <AvailabilityWindow label="Accept preferences" start="hotelPreferencesStart"
                                end="hotelPreferencesEnd" timezone={props.event.timezone} />
            <Grid size={{ xs: 12 }}>
                <Divider />
            </Grid>
            <Grid size={{ xs: 12 }}>
                <Stack direction="column" spacing={2}>
                    <HotelConfigurationTable event={props.event.slug} />
                </Stack>
            </Grid>
        </FormGridSection>
    );
}
