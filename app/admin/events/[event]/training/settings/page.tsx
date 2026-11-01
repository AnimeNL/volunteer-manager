// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import PublishedWithChangesIcon from '@mui/icons-material/PublishedWithChanges';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { AvailabilityToggle } from '@app/admin/components/AvailabilityToggle';
import { AvailabilityWindow } from '@app/admin/components/AvailabilityWindow';
import { DataTable, createDataSource, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { LogBuilder } from '@lib/log/index';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { formatDate } from '@lib/Temporal';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tEvents, tTrainings, tTrainingsAssignments } from '@lib/database';

import { kEventTransformer } from '@app/admin/components/DataTable';

import { updateTrainingConfiguration } from '../TrainingActions';

/**
 * Converts a `date` (YYYY-MM-DD) and `time` (HH:mm) in the given `timeZone` to a `ZonedDateTime`.
 */
function toZonedDateTime(date: string, time: string, timeZone: string): Temporal.ZonedDateTime {
    return Temporal.PlainDate.from(date)
        .toZonedDateTime({
            timeZone,
            plainTime: Temporal.PlainTime.from(time),
        });
}

/**
 * Data source for managing the available training sessions for an event.
 */
const settingsDataSource = createDataSource('admin/event/training/settings', withContext({
    /**
     * Event for which training session settings are being configured.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of this entry in the configuration.
     */
    id: z.number(),

    /**
     * Date (YYYY-MM-DD) on which the training session will take place.
     */
    date: z.string().regex(/^\d{4}\-\d{2}\-\d{2}$/),

    /**
     * Time (HH:mm) at which the training session will start.
     */
    start: z.string().regex(/^\d{2}:\d{2}$/),

    /**
     * Time (HH:mm) at which the training session will end.
     */
    end: z.string().regex(/^\d{2}:\d{2}$/),

    /**
     * Address at which the training session will take place.
     */
    address: z.string().nullish(),

    /**
     * Maximum capacity of the training session.
     */
    capacity: z.number(),

    /**
     * Whether this training session is protected from deletion due to existing assignments.
     */
    protected: z.boolean(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'event.trainings',
            scope: {
                event: context.event.slug,
            },
        });
    },

    async create(partialRow, props, context) {
        if (!context.event.flags.enableTraining)
            notFound();

        if (!partialRow.date || !partialRow.start || !partialRow.end || !partialRow.capacity)
            return false;  // required columns

        const insertId = await db.insertInto(tTrainings)
            .set({
                eventId: context.event.id,
                trainingStart:
                    toZonedDateTime(partialRow.date, partialRow.start, context.event.timeZone),
                trainingEnd:
                    toZonedDateTime(partialRow.date, partialRow.end, context.event.timeZone),
                trainingAddress: partialRow.address ?? null,
                trainingCapacity: partialRow.capacity,
                trainingVisible: 1,
            })
            .returningLastInsertedId()
            .executeInsert();

        LogBuilder.for('CreateTrainingSession')
            .withCondition(!!insertId)
            .withInitiatorUser(props.user)
            .record({
                event: context.event.shortName,
                date: partialRow.date,
            });

        return !!insertId;
    },

    async delete(row, props, context) {
        if (!context.event.flags.enableTraining)
            notFound();

        const dbInstance = db;
        const activeAssignments = await dbInstance.selectFrom(tTrainingsAssignments)
            .where(tTrainingsAssignments.eventId.equals(context.event.id))
                .and(tTrainingsAssignments.assignmentTrainingId.equals(row.id))
            .selectCountAll()
            .executeSelectOne();

        if (activeAssignments > 0)
            return false;

        const affectedRows = await dbInstance.update(tTrainings)
            .set({
                trainingVisible: 0,
            })
            .where(tTrainings.trainingId.equals(row.id))
                .and(tTrainings.eventId.equals(context.event.id))
                .and(tTrainings.trainingVisible.equals(/* true= */ 1))
            .executeUpdate();

        LogBuilder.for('DeleteTrainingSession')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                event: context.event.shortName,
                date: row.date,
            });

        return !!affectedRows;
    },

    async list(params, props, context) {
        if (!context.event.flags.enableTraining)
            notFound();

        const trainingsAssignmentsJoin = tTrainingsAssignments.forUseInLeftJoin();

        const dbInstance = db;
        const trainings = await dbInstance.selectFrom(tTrainings)
            .leftJoin(trainingsAssignmentsJoin)
                .on(trainingsAssignmentsJoin.eventId.equals(tTrainings.eventId))
                    .and(trainingsAssignmentsJoin.assignmentTrainingId.equals(
                        tTrainings.trainingId))
            .where(tTrainings.eventId.equals(context.event.id))
                .and(tTrainings.trainingVisible.equals(/* true= */ 1))
            .select({
                id: tTrainings.trainingId,
                address: tTrainings.trainingAddress,
                capacity: tTrainings.trainingCapacity,
                start: tTrainings.trainingStart,
                end: tTrainings.trainingEnd,
                assignments: dbInstance.count(trainingsAssignmentsJoin.assignmentId),
            })
            .groupBy(tTrainings.trainingId)
            .orderBy(tTrainings.trainingStart, 'asc')
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: trainings.count,
            rows: trainings.data.map(training => {
                const start = training.start.withTimeZone(context.event.timeZone);
                const end = training.end.withTimeZone(context.event.timeZone);

                return {
                    id: training.id,
                    date: formatDate(start, 'YYYY-MM-DD'),
                    start: formatDate(start, 'HH:mm'),
                    end: formatDate(end, 'HH:mm'),
                    address: training.address,
                    capacity: training.capacity,
                    protected: training.assignments > 0,
                };
            }),
        };
    },

    async update(row, previousRow, props, context) {
        if (!context.event.flags.enableTraining)
            notFound();

        const affectedRows = await db.update(tTrainings)
            .set({
                trainingStart: toZonedDateTime(row.date, row.start, context.event.timeZone),
                trainingEnd: toZonedDateTime(row.date, row.end, context.event.timeZone),
                trainingAddress: row.address ?? null,
                trainingCapacity: row.capacity,
            })
            .where(tTrainings.trainingId.equals(row.id))
                .and(tTrainings.eventId.equals(context.event.id))
                .and(tTrainings.trainingVisible.equals(/* true= */ 1))
            .executeUpdate();

        LogBuilder.for('UpdateTrainingSession')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withDiff({
                Date: {
                    before: previousRow.date,
                    after: row.date,
                },
                'Start time': {
                    before: previousRow.start,
                    after: row.start,
                },
                'End time': {
                    before: previousRow.end,
                    after: row.end,
                },
                Address: {
                    before: previousRow.address ?? '',
                    after: row.address ?? '',
                },
                Capacity: {
                    before: previousRow.capacity,
                    after: row.capacity,
                },
            })
            .record({
                event: context.event.shortName,
                date: row.date,
            });

        return !!affectedRows;
    },
});

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

    const dbInstance = db;
    const defaultValues = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventId.equals(event.id))
        .select({
            trainingInformationPublished: tEvents.trainingInformationPublished,
            trainingPreferencesStart: dbInstance.dateTimeAsString(tEvents.trainingPreferencesStart),
            trainingPreferencesEnd: dbInstance.dateTimeAsString(tEvents.trainingPreferencesEnd),
        })
        .projectingOptionalValuesAsNullable()
        .executeSelectNoneOrOne() ?? undefined;

    const action = updateTrainingConfiguration.bind(null, event.slug);

    const columns: Column<ExtractRowModel<typeof settingsDataSource>>[] = [
        {
            field: 'date',
            headerName: 'Date',
            editable: true,
            sortable: false,
            flex: 1,

            template: 'date',

            editorProps: {
                placeholder: 'YYYY-MM-DD',
                required: true,
            },
        },
        {
            field: 'start',
            headerName: 'Start time',
            editable: true,
            sortable: false,
            flex: 1,

            editorProps: {
                placeholder: 'HH:mm',
                required: true,
            },
        },
        {
            field: 'end',
            headerName: 'End time',
            editable: true,
            sortable: false,
            flex: 1,

            editorProps: {
                placeholder: 'HH:mm',
                required: true,
            },
        },
        {
            field: 'address',
            headerName: 'Address',
            editable: true,
            sortable: false,
            flex: 2,

            template: 'text',
        },
        {
            field: 'capacity',
            headerName: 'Capacity',
            editable: true,
            sortable: false,
            type: 'number',
            flex: 1,

            editorProps: {
                required: true,
            },
        },
    ];

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
            <Section noHeader tabs>
                <DataTable columns={columns} source={settingsDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'date', sort: 'asc' }}
                           disableFooter pageSize={100} protectedColumn="protected"
                           subject="training session"
                           listViewProps={{
                               primaryTemplate: '{date} ({start}–{end})',
                               secondaryTemplate: '{address} ({capacity}p)',
                           }} />
            </Section>
            <FormGridSection icon={ <PublishedWithChangesIcon /> } title="Availability"
                             action={action} defaultValues={defaultValues}
                             timezone={event.timeZone}>
                <SectionIntroduction grid>
                    Set the timeframe for accepting training preferences from volunteers.
                </SectionIntroduction>
                <AvailabilityToggle label="Publish information"
                                    name="trainingInformationPublished" />
                <AvailabilityWindow label="Accept preferences" start="trainingPreferencesStart"
                                    end="trainingPreferencesEnd" timezone={event.timeZone} />
            </FormGridSection>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Settings', 'Trainings', { event: 'event' });
