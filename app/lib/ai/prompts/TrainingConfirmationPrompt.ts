// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { AuthorContextParameters } from './context/AuthorContextParameters';
import type { EventContextParameters } from './context/EventContextParameters';
import type { Language } from '../Language';
import type { RecipientContextParameters } from './context/RecipientContextParameters';
import type { TeamContextParameters } from './context/TeamContextParameters';
import type { TrainingContextParameters } from './context/TrainingContextParameters';
import { Prompt } from '../Prompt';
import { kAuthorContextExampleParameters } from './context/AuthorContextParameters';
import { kEventContextExampleParameters } from './context/EventContextParameters';
import { kRecipientContextExampleParameters } from './context/RecipientContextParameters';
import { kTeamContextExampleParameters } from './context/TeamContextParameters';
import { kTrainingContextExampleParameters } from './context/TrainingContextParameters';

/**
 * Parameters accepted by this prompt.
 */
type TrainingConfirmationPromptParameters =
    AuthorContextParameters & EventContextParameters & RecipientContextParameters &
    TeamContextParameters & TrainingContextParameters;

/**
 * This prompt will be used when confirming a training session assignment to a volunteer.
 */
export class TrainingConfirmationPrompt extends Prompt<TrainingConfirmationPromptParameters> {
    override get metadata() {
        return {
            id: 'training-confirmation',
            type: 'Communication',
            label: 'Training participation confirmation',
            regarding: 'their training participation',
            description:
                'Message to confirm to a volunteer whether and in which training session they ' +
                'will participate.',
            settings: {
                prompt: 'ai-communication-type-training-confirmation',
            },
        } as const;
    }

    override get exampleParameters() {
        return {
            author: kAuthorContextExampleParameters,
            event: kEventContextExampleParameters,
            recipient: kRecipientContextExampleParameters,
            team: kTeamContextExampleParameters,
            training: kTrainingContextExampleParameters,
        };
    }

    override getSubject(params: TrainingConfirmationPromptParameters, language: Language) {
        switch (language) {
            case 'Dutch':
                return `Training voor ${params.event.shortName}`;

            case 'English':
                return `Training for ${params.event.shortName}`;
        }
    }
}
