// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';

import { AvailabilityToggle } from '@app/admin/components/AvailabilityToggle';
import { AvailabilityWindow } from '@app/admin/components/AvailabilityWindow';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { TrainingConfigurationTable } from './TrainingConfigurationTable';
import { executeServerAction } from '@lib/serverAction';
import db, { tEvents } from '@lib/database';

import { kTemporalZonedDateTime } from '@app/api/Types';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';

/**
 * The data associated with a training session configuration update.
 */
const kTrainingConfigurationData = z.object({
    /**
     * Whether training sessions should be published on the registration portal.
     */
    trainingInformationPublished: z.coerce.number(),

    /**
     * Moment in time, if any, at which we'll start to accept training preferences.
     */
    trainingPreferencesStart: kTemporalZonedDateTime.nullish(),

    /**
     * Moment in time, if any, at which applications will no longer accept training preferences.
     */
    trainingPreferencesEnd: kTemporalZonedDateTime.nullish(),
});

/**
 * Server Action that will be invoked when the training configuration is being updated by a senior
 * volunteer. Synchronises the state update request with the database.
 */
async function updateTrainingConfiguration(eventId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kTrainingConfigurationData, async (data, props) => {
        const eventName = await db.selectFrom(tEvents)
            .where(tEvents.eventId.equals(eventId))
            .selectOneColumn(tEvents.eventShortName)
            .executeSelectOne();

        await db.update(tEvents)
            .set({
                trainingInformationPublished: data.trainingInformationPublished,
                trainingPreferencesStart: data.trainingPreferencesStart,
                trainingPreferencesEnd: data.trainingPreferencesEnd,
            })
            .where(tEvents.eventId.equals(eventId))
            .executeUpdate();

        RecordLog({
            type: kLogType.AdminEventPublishInfo,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                event: eventName,
                published: !!data.trainingInformationPublished,
                type: 'training',
            },
        });
    });
}

/**
 * Props accepted by the <TrainingConfiguration> component.
 */
interface TrainingConfigurationProps {
    /**
     * Information about the event for which training sessions are being shown.
     */
    event: {
        id: number;
        slug: string;
        timezone: string;
    };
}

/**
 * The <TrainingConfiguration> component displays the options that are available for our volunteers
 * to get trained ahead of the convention. This is a fairly straightforward set of dates.
 */
export async function TrainingConfiguration(props: TrainingConfigurationProps) {
    const action = updateTrainingConfiguration.bind(null, props.event.id);

    const dbInstance = db;
    const configuration = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventId.equals(props.event.id))
        .select({
            trainingInformationPublished: tEvents.trainingInformationPublished,
            trainingPreferencesStart: dbInstance.dateTimeAsString(tEvents.trainingPreferencesStart),
            trainingPreferencesEnd: dbInstance.dateTimeAsString(tEvents.trainingPreferencesEnd),
        })
        .projectingOptionalValuesAsNullable()
        .executeSelectNoneOrOne() ?? undefined;

    return (
        <FormGridSection action={action} defaultValues={configuration}
                         timezone={props.event.timezone} title="Training sessions">
            <Grid size={{ xs: 12 }}>
                <SectionIntroduction>
                    This section allows you to specify which training sessions are available, and to
                    decide whether this information should be publicly accessible. Additionally, you
                    can set the time frame during which volunteers can share their preferences.
                </SectionIntroduction>
            </Grid>
            <AvailabilityToggle label="Publish information" name="trainingInformationPublished" />
            <AvailabilityWindow label="Accept preferences" start="trainingPreferencesStart"
                                end="trainingPreferencesEnd" timezone={props.event.timezone} />
            <Grid size={{ xs: 12 }}>
                <Divider />
            </Grid>
            <Grid size={{ xs: 12 }}>
                <TrainingConfigurationTable event={props.event.slug}
                                            timezone={props.event.timezone} />
            </Grid>
        </FormGridSection>
    );
}
