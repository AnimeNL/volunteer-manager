// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Collapse from '@mui/material/Collapse';

import type { TrainingsAssignmentsRowModel } from '@app/api/admin/trainings/assignments/[[...id]]/route';
import { Temporal } from '@lib/Temporal';
import { TrainingAssignments } from './TrainingAssignments';
import { TrainingConfiguration } from './TrainingConfiguration';
import { TrainingExternal } from './TrainingExternal';
import { TrainingOverview, type TrainingConfirmation } from './TrainingOverview';
import { TrainingProcessor } from './TrainingProcessor';
import { generateEventMetadataFn } from '../generateEventMetadataFn';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tRoles, tTeams, tTrainings, tTrainingsAssignments, tTrainingsExtra, tUsersEvents,
    tUsers } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

export default async function EventTrainingPage(
    props: PageProps<'/admin/events/[event]/training'>)
{
    const params = await props.params;

    const { access, event } = await verifyAccessAndFetchPageInfo(props.params, {
        permission: 'event.trainings',
        scope: {
            event: params.event,
        },
    });

    if (!event.trainingEnabled)
        notFound();

    const processor = new TrainingProcessor(event.id);
    await processor.initialise();

    const trainingsAssignmentsJoin = tTrainingsAssignments.forUseInLeftJoin();

    const dbInstance = db;
    const assignments = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .leftJoin(trainingsAssignmentsJoin)
            .on(trainingsAssignmentsJoin.eventId.equals(tUsersEvents.eventId))
            .and(trainingsAssignmentsJoin.assignmentUserId.equals(tUsersEvents.userId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .and(
                tUsersEvents.trainingEligible.equals(/* true= */ 1).or(
                    tRoles.roleTrainingEligible.equals(/* true= */ 1)))
        .select({
            userId: tUsersEvents.userId,

            name: tUsers.name,
            team: tTeams.teamSlug,

            preferenceTrainingId: trainingsAssignmentsJoin.preferenceTrainingId,
            preferenceUpdated: trainingsAssignmentsJoin.preferenceUpdated,

            assignedTrainingId: trainingsAssignmentsJoin.assignmentTrainingId,
            assignedUpdated:
                dbInstance.dateTimeAsString(trainingsAssignmentsJoin.assignmentUpdated),

            confirmed: trainingsAssignmentsJoin.assignmentConfirmed,
        })
        .orderBy('name', 'asc')
        .executeSelectMany();

    const extraParticipants = await dbInstance.selectFrom(tTrainingsExtra)
        .leftJoin(trainingsAssignmentsJoin)
            .on(trainingsAssignmentsJoin.eventId.equals(tTrainingsExtra.eventId))
            .and(trainingsAssignmentsJoin.assignmentExtraId.equals(tTrainingsExtra.trainingExtraId))
        .where(tTrainingsExtra.eventId.equals(event.id))
            .and(tTrainingsExtra.trainingExtraVisible.equals(/* true= */ 1))
        .select({
            id: tTrainingsExtra.trainingExtraId,

            trainingExtraName: tTrainingsExtra.trainingExtraName,
            trainingExtraEmail: tTrainingsExtra.trainingExtraEmail,
            trainingExtraBirthdate: dbInstance.dateAsString(tTrainingsExtra.trainingExtraBirthdate),

            preferenceTrainingId: trainingsAssignmentsJoin.preferenceTrainingId,
            preferenceUpdated:
                dbInstance.dateTimeAsString(trainingsAssignmentsJoin.preferenceUpdated),

            assignedTrainingId: trainingsAssignmentsJoin.assignmentTrainingId,
            assignedUpdated:
                dbInstance.dateTimeAsString(trainingsAssignmentsJoin.assignmentUpdated),

            confirmed: trainingsAssignmentsJoin.assignmentConfirmed,
        })
        .orderBy(tTrainingsExtra.trainingExtraName, 'asc')
        .executeSelectMany();

    const trainings = await db.selectFrom(tTrainings)
        .where(tTrainings.eventId.equals(event.id))
            .and(tTrainings.trainingVisible.equals(/* true= */ 1))
        .select({
            id: tTrainings.trainingId,
            trainingAddress: tTrainings.trainingAddress,
            trainingCapacity: tTrainings.trainingCapacity,
            trainingStart: tTrainings.trainingStart,
            trainingEnd: tTrainings.trainingEnd,
        })
        .orderBy(tTrainings.trainingStart, 'asc')
        .executeSelectMany();

    // ---------------------------------------------------------------------------------------------
    // Combine the information to create a comprehensive assignment table
    // ---------------------------------------------------------------------------------------------

    const trainingAssignments: Omit<TrainingsAssignmentsRowModel, 'id'>[] = [];

    for (const assignment of [ ...assignments, ...extraParticipants ]) {
        let preferredTrainingId: number | null | undefined = undefined;
        let assignedTrainingId: number | undefined = undefined;

        if (!!assignment.preferenceUpdated)
            preferredTrainingId = assignment.preferenceTrainingId ?? null;

        if (!!assignment.assignedUpdated)
            assignedTrainingId = assignment.assignedTrainingId ?? /* skip= */ 0;

        if ('trainingExtraName' in assignment) {
            trainingAssignments.push({
                name: assignment.trainingExtraName,

                // userId: none
                // team: none

                preferredTrainingId, assignedTrainingId,
                confirmed: !!assignment.confirmed,
            });
        } else {
            trainingAssignments.push({
                name: assignment.name,

                userId: assignment.userId,
                team: assignment.team,

                preferredTrainingId, assignedTrainingId,
                confirmed: !!assignment.confirmed,
            });
        }
    }

    // Sort the training assignments alphabetically by name of the participant.
    trainingAssignments.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

    // ---------------------------------------------------------------------------------------------
    // Then process it again towards the confirmation table, combined with training information
    // ---------------------------------------------------------------------------------------------

    const trainingConfirmations: { [key: number]: TrainingConfirmation } = {};
    let trainingConfirmationCount = 0;

    for (const training of trainings) {
        trainingConfirmations[training.id] = {
            capacity: training.trainingCapacity,
            date: training.trainingStart.toString(),
            participants: [],
        };
    }

    for (const assignment of trainingAssignments) {
        if (!assignment.assignedTrainingId)
            continue;

        if (!trainingConfirmations.hasOwnProperty(assignment.assignedTrainingId))
            continue;  // this should not happen.. deleted trainings?

        trainingConfirmationCount++;
        trainingConfirmations[assignment.assignedTrainingId].participants.push({
            name: assignment.name,
            userId: assignment.userId,
            team: assignment.team,
            confirmed: assignment.confirmed,
        });
    }

    const confirmations = [ ...Object.values(trainingConfirmations) ];
    for (let index = 0; index < confirmations.length; ++index) {
        confirmations[index].participants.sort((lhs, rhs) => {
            if (lhs.confirmed !== rhs.confirmed)
                return lhs.confirmed ? -1 : 1;

            return lhs.name.localeCompare(rhs.name);
        });
    }

    confirmations.sort((lhs, rhs) => {
        return Temporal.ZonedDateTime.compare(
            Temporal.ZonedDateTime.from(lhs.date),
            Temporal.ZonedDateTime.from(rhs.date));
    });

    const trainingOptions = processor.compileTrainingOptions();
    const warnings = processor.compileWarnings();

    const enableExport = access.can('organisation.exports');

    return (
        <>
            <Collapse in={trainingConfirmationCount > 0} sx={{ mt: '-16px !important' }}>
                <TrainingOverview confirmations={confirmations} enableExport={enableExport} />
            </Collapse>
            <Collapse in={event.trainingInformationPublished && trainingAssignments.length > 0}
                      sx={{ mt: '0px !important' }}>
                <TrainingAssignments event={event.slug} trainings={trainingOptions}
                                     warnings={warnings}/>
            </Collapse>
            <TrainingExternal event={event} trainings={trainingOptions} />
            <TrainingConfiguration event={event} />
        </>
    );
}

export const generateMetadata = generateEventMetadataFn('Trainings');
