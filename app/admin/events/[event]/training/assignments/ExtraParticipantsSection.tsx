// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import GroupAddIcon from '@mui/icons-material/GroupAdd';

import type { CachedEvent } from '@lib/cache';
import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import type { TrainingSessionCellContext } from './TrainingAssignmentCells';
import { DataTable, createDataSource, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { ExpandableSection } from '@app/admin/components/ExpandableSection';
import { LogBuilder } from '@lib/log/index';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TrainingSessionCell } from './TrainingAssignmentCells';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { readUserSetting } from '@lib/UserSettings';
import db, { tTrainingsAssignments, tTrainingsExtra } from '@lib/database';

import { kEventTransformer } from '@app/admin/components/DataTable';

/**
 * Data source for managing extra participants who join the training sessions outside of our teams.
 */
const extraDataSource = createDataSource('admin/event/training/assignments/extra', withContext({
    /**
     * Event for which extra training participants are being managed.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of this entry in the extra participants table.
     */
    id: z.number(),

    /**
     * Full name of the participant who would like to join.
     */
    name: z.string(),

    /**
     * E-mail address of the participant who would like to join.
     */
    email: z.string(),

    /**
     * Date of birth (YYYY-MM-DD) of the participant, needed for certification purposes.
     */
    birthdate: z.string().regex(/^\d{4}\-\d{2}\-\d{2}$/).nullish(),

    /**
     * Preferred training session (`-1` = pending, `0` = skip, `>0` = trainingId).
     */
    preferenceTrainingId: z.number(),

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

        if (!partialRow.name || !partialRow.email)
            return false;  // required columns

        const dbInstance = db;
        const insertId = await dbInstance.insertInto(tTrainingsExtra)
            .set({
                eventId: context.event.id,
                trainingExtraName: partialRow.name,
                trainingExtraEmail: partialRow.email,
                trainingExtraBirthdate: partialRow.birthdate
                    ? Temporal.PlainDate.from(partialRow.birthdate)
                    : null,
                trainingExtraVisible: 1,
            })
            .returningLastInsertedId()
            .executeInsert();

        if (insertId && typeof partialRow.preferenceTrainingId === 'number' &&
            partialRow.preferenceTrainingId >= 0)
        {
            const preferenceTrainingId =
                partialRow.preferenceTrainingId > 0 ? partialRow.preferenceTrainingId : null;

            await dbInstance.insertInto(tTrainingsAssignments)
                .set({
                    eventId: context.event.id,
                    assignmentExtraId: insertId,
                    preferenceTrainingId,
                    preferenceUpdated: dbInstance.currentZonedDateTime(),
                })
                .executeInsert();
        }

        LogBuilder.for('CreateTrainingExtraParticipant')
            .withCondition(!!insertId)
            .withInitiatorUser(props.user)
            .record({
                event: context.event.shortName,
                name: partialRow.name,
            });

        return !!insertId;
    },

    async delete(row, props, context) {
        if (!context.event.flags.enableTraining)
            notFound();

        const affectedRows = await db.update(tTrainingsExtra)
            .set({
                trainingExtraVisible: 0,
            })
            .where(tTrainingsExtra.trainingExtraId.equals(row.id))
                .and(tTrainingsExtra.eventId.equals(context.event.id))
                .and(tTrainingsExtra.trainingExtraVisible.equals(/* true= */ 1))
            .executeUpdate();

        LogBuilder.for('DeleteTrainingExtraParticipant')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                event: context.event.shortName,
                name: row.name,
            });

        return !!affectedRows;
    },

    async list(params, props, context) {
        if (!context.event.flags.enableTraining)
            notFound();

        const trainingsAssignmentsJoin = tTrainingsAssignments.forUseInLeftJoin();

        const dbInstance = db;
        const participants = await dbInstance.selectFrom(tTrainingsExtra)
            .leftJoin(trainingsAssignmentsJoin)
                .on(trainingsAssignmentsJoin.eventId.equals(tTrainingsExtra.eventId))
                    .and(trainingsAssignmentsJoin.assignmentExtraId.equals(
                        tTrainingsExtra.trainingExtraId))
            .where(tTrainingsExtra.eventId.equals(context.event.id))
                .and(tTrainingsExtra.trainingExtraVisible.equals(/* true= */ 1))
            .select({
                id: tTrainingsExtra.trainingExtraId,
                name: tTrainingsExtra.trainingExtraName,
                email: tTrainingsExtra.trainingExtraEmail,
                birthdate: dbInstance.dateAsString(tTrainingsExtra.trainingExtraBirthdate),
                preferenceTrainingId: trainingsAssignmentsJoin.preferenceTrainingId,
                preferenceUpdated: trainingsAssignmentsJoin.preferenceUpdated.isNotNull(),
            })
            .orderBy(tTrainingsExtra.trainingExtraName, 'asc')
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: participants.count,
            rows: participants.data.map(participant => ({
                id: participant.id,
                name: participant.name,
                email: participant.email,
                birthdate: participant.birthdate,
                preferenceTrainingId: participant.preferenceUpdated
                    ? (participant.preferenceTrainingId ?? 0)
                    : -1,
            })),
        };
    },

    async update(row, previousRow, props, context) {
        if (!context.event.flags.enableTraining)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.transaction(async () => {
            const updatedExtraRows = await dbInstance.update(tTrainingsExtra)
                .set({
                    trainingExtraName: row.name,
                    trainingExtraEmail: row.email,
                    trainingExtraBirthdate: row.birthdate
                        ? Temporal.PlainDate.from(row.birthdate)
                        : null,
                })
                .where(tTrainingsExtra.trainingExtraId.equals(row.id))
                    .and(tTrainingsExtra.eventId.equals(context.event.id))
                    .and(tTrainingsExtra.trainingExtraVisible.equals(/* true= */ 1))
                .executeUpdate();

            let updatedPreferenceRows = 0;
            if (row.preferenceTrainingId !== previousRow.preferenceTrainingId) {
                const preferenceTrainingId =
                    row.preferenceTrainingId > 0 ? row.preferenceTrainingId : null;
                const preferenceUpdated =
                    row.preferenceTrainingId >= 0 ? dbInstance.currentZonedDateTime() : null;

                updatedPreferenceRows = await dbInstance.insertInto(tTrainingsAssignments)
                    .set({
                        eventId: context.event.id,
                        assignmentExtraId: row.id,
                        preferenceTrainingId,
                        preferenceUpdated,
                    })
                    .onConflictDoUpdateSet({
                        preferenceTrainingId,
                        preferenceUpdated,
                    })
                    .executeInsert();
            }

            return updatedExtraRows + updatedPreferenceRows;
        });

        LogBuilder.for('UpdateTrainingExtraParticipant')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .record({
                event: context.event.shortName,
                name: row.name,
            });

        return !!affectedRows;
    },
});

/**
 * Props accepted by the <ExtraParticipantsSection> component.
 */
interface ExtraParticipantsSectionProps {
    /**
     * Information about the event for which extra training participants are being shown.
     */
    event: CachedEvent;

    /**
     * The trainings that are available for the external folks to participate in.
     */
    trainings: { value: number; label: string }[];

    /**
     * Unique ID of the signed-in user, to persist the section's expanded state.
     */
    userId: number;
}

/**
 * Displays a collapsible section for managing extra people who may want to join in the training
 * sessions, outside of the volunteers we have within our teams.
 */
export async function ExtraParticipantsSection(props: ExtraParticipantsSectionProps) {
    const { event, trainings, userId } = props;

    const extraParticipantsCount = await db.selectFrom(tTrainingsExtra)
        .where(tTrainingsExtra.eventId.equals(event.id))
            .and(tTrainingsExtra.trainingExtraVisible.equals(/* true= */ 1))
        .selectCountAll()
        .executeSelectOne();

    const defaultExpanded =
        await readUserSetting(userId, 'user-admin-training-expand-extra') ?? false;

    const columns: Column<ExtractRowModel<typeof extraDataSource>>[] = [
        {
            field: 'name',
            headerName: 'Full name',
            editable: true,
            sortable: false,
            flex: 1,

            editorProps: {
                required: true,
            },
        },
        {
            field: 'email',
            headerName: 'E-mail address',
            editable: true,
            sortable: false,
            flex: 1,

            editorProps: {
                required: true,
            },
        },
        {
            field: 'birthdate',
            headerName: 'Birthdate',
            editable: true,
            sortable: false,
            flex: 1,

            template: 'date',

            editorProps: {
                placeholder: 'YYYY-MM-DD',
            },
        },
        {
            field: 'preferenceTrainingId',
            headerName: 'Preference',
            editable: true,
            sortable: false,
            flex: 1,

            type: 'singleSelect',
            valueOptions: trainings,

            template: 'component',
            templateProps: {
                component: TrainingSessionCell,
                componentContext: {
                    field: 'preferenceTrainingId',
                    pendingTooltip: 'Pending preferences',
                    trainings,
                } satisfies TrainingSessionCellContext,
            },
        },
    ];

    const subtitle = extraParticipantsCount > 0
        ? `${extraParticipantsCount}`
        : undefined;

    return (
        <ExpandableSection defaultExpanded={defaultExpanded} icon={ <GroupAddIcon /> }
                           setting="user-admin-training-expand-extra" subtitle={subtitle}
                           title="Extra participants">
            <SectionIntroduction>
                This table enables you to add people who would like to participate in the training
                sessions, but are not part of our teams.
            </SectionIntroduction>
            <DataTable columns={columns} source={extraDataSource}
                       context={{ event: event.slug }}
                       defaultSort={{ field: 'name', sort: 'asc' }}
                       disableFooter pageSize={100} refreshOnMutation subject="extra participant"
                       listViewProps={{
                           primaryField: 'name',
                           secondaryField: 'email',
                           dateField: 'birthdate',
                       }} />
        </ExpandableSection>
    );
}
