// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type Temporal, formatDate } from '@lib/Temporal';
import db, { tTrainings } from '@lib/database';

/**
 * Record detailing the information stored about a training session.
 */
interface TrainingRecord {
    id: number;
    start: Temporal.ZonedDateTime;
    end: Temporal.ZonedDateTime;
    visible: boolean;
}

/**
 * Type defining how we represent a training option.
 */
type Option = { value: number; label: string; };

/**
 * Type defining how we represent a warning in our system.
 */
type Warning = { volunteer: string, warning: string };

/**
 * The `TrainingProcessor` class operates on all training-associated data for an event and produces
 * warnings, lists and other data by executing operations on it.
 */
export class TrainingProcessor {
    #eventId: number;

    #trainings: TrainingRecord[] = [];

    constructor(eventId: number) {
        this.#eventId = eventId;
    }

    async initialise() {
        this.#trainings = await db.selectFrom(tTrainings)
            .where(tTrainings.eventId.equals(this.#eventId))
            .select({
                id: tTrainings.trainingId,
                start: tTrainings.trainingStart,
                end: tTrainings.trainingEnd,
                visible: tTrainings.trainingVisible.equals(/* true= */ 1),
            })
            .orderBy('start', 'asc')
            .executeSelectMany();
    }

    /**
     * Returns a list, to be used in a select element, of the available training options.
     */
    compileTrainingOptions(): Option[] {
        const options = [
            { value: -1, label: ' ' },
            { value:  0, label: 'Skip the training' },
        ];

        for (const training of this.#trainings) {
            if (!training.visible)
                continue;  // skip deleted trainings

            options.push({
                value: training.id,
                label: formatDate(training.start, 'dddd, MMMM D'),
            });
        }

        return options;
    }

    /**
     * Returns a list of warnings that should be displayed on the training overview.
     */
    compileWarnings(): Warning[] {
        // TODO: Assigned while they preferred not to be assigned.
        // TODO: Assigned to another session than the one they preferred to join.
        // TODO: Not assigned while they preferred to be assigned.
        // TODO: Assigned to a deleted training session.
        return [];
    }
}
