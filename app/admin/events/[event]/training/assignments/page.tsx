// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import type {
    TrainingCommunicationCellContext, TrainingParticipantCellContext, TrainingSessionCellContext }
    from './TrainingAssignmentCells';
import { BooleanCell } from '@app/admin/components/DataTable/cells/BooleanCell';
import { ConfirmedParticipationSection } from './ConfirmedParticipationSection';
import { DataTable, createDataSource, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { ExtraParticipantsSection } from './ExtraParticipantsSection';
import { LogBuilder } from '@lib/log/index';
import { PreferenceHistorySection } from './PreferenceHistorySection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import {
    TrainingCommunicationCell, TrainingCommunicationHeaderCell, TrainingParticipantCell,
    TrainingSessionCell } from './TrainingAssignmentCells';
import { TrainingProcessor } from '../TrainingProcessor';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { processVolunteerCommunication } from '../../[team]/volunteers/dataSource';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tEvents, tRoles, tTeams, tTrainingsAssignments, tTrainingsExtra, tUsers,
    tUsersCommunication, tUsersEvents, tUsersEventsPreferencesTraining } from '@lib/database';

import { kCommunicationLanguage, kRegistrationStatus } from '@lib/database/Types';
import { kEventTransformer } from '@app/admin/components/DataTable';

import { sendTrainingConfirmationCommunication } from '../TrainingActions';

/**
 * Data source for managing training session assignments for volunteers and external participants.
 */
const assignmentsDataSource = createDataSource('admin/event/training/assignments', withContext({
    /**
     * Event for which training assignments are being managed.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique row identifier (`user-${userId}` or `extra-${extraId}`).
     */
    id: z.string(),

    /**
     * Full name of the participant.
     */
    name: z.string(),

    /**
     * Whether this is the first time the volunteer might participate in the training.
     */
    new: z.boolean(),

    /**
     * Unique user ID when the participant is a volunteer.
     */
    userId: z.number().optional(),

    /**
     * Unique extra participant ID when the participant is external.
     */
    extraId: z.number().optional(),

    /**
     * Preferred language and communication history when the participant is a volunteer.
     */
    language: z.enum(kCommunicationLanguage).optional(),
    communication: z.record(z.string(), z.string()).optional(),

    /**
     * Team information when the participant is a volunteer.
     */
    team: z.object({
        id: z.number(),
        color: z.string(),
        name: z.string(),
        slug: z.string(),
    }).optional(),

    /**
     * Preferred training ID (`-1` = pending, `0` = skip, `>0` = trainingId).
     */
    preferredTrainingId: z.number(),

    /**
     * Assigned training ID (`-1` = pending, `0` = skip, `>0` = trainingId).
     */
    assignedTrainingId: z.number(),

    /**
     * Whether the assignment has been confirmed, and can be communicated.
     */
    confirmed: z.boolean(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'event.trainings',
            scope: {
                event: context.event.slug,
            },
        });
    },

    async list(params, props, context) {
        if (!context.event.flags.enableTraining)
            notFound();

        const dbInstance = db;
        const experiencedUsers = new Set(await dbInstance.selectDistinctFrom(tTrainingsAssignments)
            .innerJoin(tEvents)
                .on(tEvents.eventId.equals(tTrainingsAssignments.eventId))
            .where(tTrainingsAssignments.assignmentUserId.isNotNull())
                .and(tTrainingsAssignments.assignmentTrainingId.isNotNull())
                .and(tTrainingsAssignments.assignmentConfirmed.isNotNull())
                .and(tEvents.eventStartTime.lessThan(context.event.startTime))
            .selectOneColumn(tTrainingsAssignments.assignmentUserId)
            .executeSelectMany());

        const preferencesTrainingJoin = tUsersEventsPreferencesTraining.forUseInLeftJoin();
        const trainingsAssignmentsJoin = tTrainingsAssignments.forUseInLeftJoin();
        const usersCommunicationJoin = tUsersCommunication.forUseInLeftJoin();

        const volunteers = await dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tRoles)
                .on(tRoles.roleId.equals(tUsersEvents.roleId))
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tUsersEvents.teamId))
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tUsersEvents.userId))
            .leftJoin(preferencesTrainingJoin)
                .on(preferencesTrainingJoin.eventId.equals(tUsersEvents.eventId))
                    .and(preferencesTrainingJoin.userId.equals(tUsersEvents.userId))
                    .and(preferencesTrainingJoin.preferenceVersionIsLatest.equals(/* true= */ 1))
            .leftJoin(trainingsAssignmentsJoin)
                .on(trainingsAssignmentsJoin.eventId.equals(tUsersEvents.eventId))
                    .and(trainingsAssignmentsJoin.assignmentUserId.equals(tUsersEvents.userId))
            .leftJoin(usersCommunicationJoin)
                .on(usersCommunicationJoin.userId.equals(tUsersEvents.userId))
                    .and(usersCommunicationJoin.communicationEventId.equals(tUsersEvents.eventId))
                    .and(usersCommunicationJoin.communicationPromptId.in([
                        'training-confirmation',
                        'training-reminder',
                    ]))
            .where(tUsersEvents.eventId.equals(context.event.id))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
                .and(
                    tUsersEvents.trainingEligible.equals(/* true= */ 1).or(
                        tRoles.roleTrainingEligible.equals(/* true= */ 1)))
            .select({
                userId: tUsersEvents.userId,
                name: tUsers.name,
                language: tUsers.language,
                team: {
                    id: tTeams.teamId,
                    color: tTeams.teamColourLightTheme,
                    name: tTeams.teamName,
                    slug: tTeams.teamSlug,
                },
                preferredTrainingId: preferencesTrainingJoin.trainingId,
                assignedTrainingId: trainingsAssignmentsJoin.assignmentTrainingId,
                assignedUpdated: trainingsAssignmentsJoin.assignmentUpdated.isNotNull(),
                confirmed: trainingsAssignmentsJoin.assignmentConfirmed,
                communication: dbInstance.aggregateAsArray({
                    promptId: usersCommunicationJoin.communicationPromptId,
                    date: usersCommunicationJoin.communicationDate,
                }),
            })
            .groupBy(tUsersEvents.userId)
            .orderBy('name', 'asc')
            .executeSelectMany();

        const extraParticipants = await dbInstance.selectFrom(tTrainingsExtra)
            .leftJoin(trainingsAssignmentsJoin)
                .on(trainingsAssignmentsJoin.eventId.equals(tTrainingsExtra.eventId))
                    .and(trainingsAssignmentsJoin.assignmentExtraId.equals(
                        tTrainingsExtra.trainingExtraId))
            .where(tTrainingsExtra.eventId.equals(context.event.id))
                .and(tTrainingsExtra.trainingExtraVisible.equals(/* true= */ 1))
            .select({
                extraId: tTrainingsExtra.trainingExtraId,
                name: tTrainingsExtra.trainingExtraName,
                preferenceTrainingId: trainingsAssignmentsJoin.preferenceTrainingId,
                preferenceUpdated: trainingsAssignmentsJoin.preferenceUpdated.isNotNull(),
                assignedTrainingId: trainingsAssignmentsJoin.assignmentTrainingId,
                assignedUpdated: trainingsAssignmentsJoin.assignmentUpdated.isNotNull(),
                confirmed: trainingsAssignmentsJoin.assignmentConfirmed,
            })
            .orderBy(tTrainingsExtra.trainingExtraName, 'asc')
            .executeSelectMany();

        const rows = [
            ...volunteers.map(volunteer => ({
                id: `user-${volunteer.userId}`,
                name: volunteer.name,
                new: !experiencedUsers.has(volunteer.userId),
                userId: volunteer.userId,
                extraId: undefined,
                language: volunteer.language ?? undefined,
                communication: processVolunteerCommunication(volunteer.communication),
                team: volunteer.team,
                preferredTrainingId: volunteer.preferredTrainingId ?? -1,
                assignedTrainingId: volunteer.assignedUpdated
                    ? (volunteer.assignedTrainingId ?? 0)
                    : -1,
                confirmed: !!volunteer.confirmed,
            })),
            ...extraParticipants.map(extra => ({
                id: `extra-${extra.extraId}`,
                name: extra.name,
                new: false,
                userId: undefined,
                extraId: extra.extraId,
                language: undefined,
                communication: undefined,
                team: undefined,
                preferredTrainingId: extra.preferenceUpdated
                    ? (extra.preferenceTrainingId ?? 0)
                    : -1,
                assignedTrainingId: extra.assignedUpdated
                    ? (extra.assignedTrainingId ?? 0)
                    : -1,
                confirmed: !!extra.confirmed,
            })),
        ];

        rows.sort((lhs, rhs) => {
            let change = 0;
            switch (params.sort.field ?? 'name') {
                case 'assignedTrainingId':
                    change = lhs.assignedTrainingId - rhs.assignedTrainingId;
                    break;

                case 'confirmed':
                    if (lhs.confirmed !== rhs.confirmed)
                        change = rhs.confirmed ? 1 : -1;
                    break;

                case 'preferredTrainingId':
                    change = lhs.preferredTrainingId - rhs.preferredTrainingId;
                    break;
            }

            if (change === 0)
                change = lhs.name.localeCompare(rhs.name);

            return change * (params.sort.direction === 'desc' ? -1 : 1);
        });

        return {
            rowCount: rows.length,
            rows,
        };
    },

    async update(row, previousRow, props, context) {
        if (!context.event.flags.enableTraining)
            notFound();

        if (!row.userId && !row.extraId)
            return false;

        const dbInstance = db;

        const assignmentTrainingId = row.assignedTrainingId > 0 ? row.assignedTrainingId : null;
        const assignmentUpdated =
            row.assignedTrainingId >= 0 ? dbInstance.currentZonedDateTime() : null;

        const affectedRows = await dbInstance.insertInto(tTrainingsAssignments)
            .set({
                eventId: context.event.id,
                assignmentUserId: row.userId ?? null,
                assignmentExtraId: row.extraId ?? null,
                assignmentTrainingId,
                assignmentUpdated,
                assignmentConfirmed: row.confirmed ? 1 : 0,
            })
            .onConflictDoUpdateSet({
                assignmentTrainingId,
                assignmentUpdated,
                assignmentConfirmed: row.confirmed ? 1 : 0,
            })
            .executeInsert();

        LogBuilder.for('UpdateTrainingAssignment')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withAffectedUser(row.userId)
            .withSeverity('Warning')
            .record({
                event: context.event.shortName,
                participant: row.name,
            });

        return !!affectedRows;
    },
});

/**
 * The <EventTrainingAssignmentsPage> page allows event administrators to view and manage training
 * session assignments for volunteers and external participants of a particular event.
 */
export default async function EventTrainingAssignmentsPage(
    props: PageProps<'/admin/events/[event]/training/assignments'>)
{
    const { access, event, user } = await requireAuthenticationWithEvent(props, 'event.trainings');
    if (!event.flags.enableTraining)
        notFound();

    const processor = new TrainingProcessor(event.id);
    await processor.initialise();

    const trainingOptions = processor.compileTrainingOptions();
    const warnings = processor.compileWarnings();

    const enableExport = access.can('organisation.exports');

    const columns: Column<ExtractRowModel<typeof assignmentsDataSource>>[] = [
        {
            field: 'name',
            headerName: 'Participant',
            editable: false,
            sortable: true,
            flex: 1,

            template: 'component',
            templateProps: {
                component: TrainingParticipantCell,
                componentContext: {
                    event: event.slug,
                } satisfies TrainingParticipantCellContext,
            },
        },
        {
            field: 'preferredTrainingId',
            headerName: 'Preference',
            editable: false,
            sortable: true,
            flex: 1,

            template: 'component',
            templateProps: {
                component: TrainingSessionCell,
                componentContext: {
                    field: 'preferredTrainingId',
                    pendingTooltip: 'Pending volunteer preferences',
                    trainings: trainingOptions,
                } satisfies TrainingSessionCellContext,
            },
        },
        {
            field: 'assignedTrainingId',
            headerName: 'Assignment',
            editable: true,
            sortable: true,
            flex: 1,

            type: 'singleSelect',
            valueOptions: trainingOptions,

            template: 'component',
            templateProps: {
                component: TrainingSessionCell,
                componentContext: {
                    field: 'assignedTrainingId',
                    pendingTooltip: 'Pending approval',
                    trainings: trainingOptions,
                } satisfies TrainingSessionCellContext,
            },
        },
        {
            field: 'confirmed',
            description: 'Has this assignment been confirmed?',
            editable: true,
            sortable: true,
            type: 'boolean',

            template: 'boolean',
            templateProps: {
                tooltips: {
                    header: 'Has the training assignment been confirmed?',
                    falsyValue: 'Assignment has not been confirmed',
                    truthyValue: 'Assignment has been confirmed',
                },
            },
        },
        {
            field: 'new',  // unrelated
            headerName: '',
            align: 'center',
            headerAlign: 'center',
            editable: false,
            sortable: false,
            width: 50,

            template: 'component',
            templateProps: {
                component: TrainingCommunicationCell,
                componentContext: {
                    action: sendTrainingConfirmationCommunication.bind(null, event.slug),
                    eventId: event.id,
                } satisfies TrainingCommunicationCellContext,
                headerComponent: TrainingCommunicationHeaderCell,
            },
        },
    ];

    return (
        <>
            <Section icon={ <HistoryEduIcon color="primary" /> } title="Training assignments"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Trainings', href: `/admin/events/${event.slug}/training` },
                         { label: 'Assignments' },
                     ]}>
                <SectionIntroduction>
                    Preferences must be indicated by volunteers and cannot be updated here.
                    Assignments will not be communicated until confirmed. A blue dot indicates that
                    they've not done the training before.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={assignmentsDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           disableFooter pageSize={100} refreshOnMutation
                           subject="training assignment"
                           listViewProps={{
                               primaryField: 'name',
                               startComponent: BooleanCell,
                               startComponentContext: { field: 'confirmed' },
                           }} />
                <Collapse in={warnings.length > 0}>
                    <Alert severity="warning" variant="outlined">
                        <Stack direction="column" spacing={0} sx={{ maxWidth: '100%' }}>
                            { warnings.map(({ volunteer, warning }, index) =>
                                <Typography key={index} variant="body2">
                                    <strong>{volunteer}</strong> {warning}
                                </Typography> )}
                        </Stack>
                    </Alert>
                </Collapse>
            </Section>
            <ConfirmedParticipationSection enableExport={enableExport} event={event}
                                           userId={user.id} />
            <ExtraParticipantsSection event={event} trainings={trainingOptions} userId={user.id} />
            <PreferenceHistorySection event={event.slug} userId={user.id} />
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Assignments', 'Trainings', { event: 'event' });
