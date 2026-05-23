// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Language } from '../Language';
import { type AuthorContextParameters, kAuthorContextExampleParameters } from './context/AuthorContextParameters';
import { type EventContextParameters, kEventContextExampleParameters } from './context/EventContextParameters';
import { Prompt } from '../Prompt';
import { type RecipientContextParameters, kRecipientContextExampleParameters } from './context/RecipientContextParameters';
import { type TeamContextParameters, kTeamContextExampleParameters } from './context/TeamContextParameters';

/**
 * Parameters accepted by this prompt.
 */
type ParticipationCancelledPromptParameters =
    AuthorContextParameters & EventContextParameters & RecipientContextParameters &
    TeamContextParameters;

/**
 * This prompt generates an e-mail message to send when a volunteer's participation is cancelled.
 */
export class ParticipationCancelledPrompt extends Prompt<ParticipationCancelledPromptParameters> {
    override get metadata() {
        return {
            id: 'participation-cancelled',
            type: 'Communication',
            label: 'Participation cancelled',
            description: 'Message to confirm that someone\'s participation has been cancelled.',
            settings: {
                prompt: 'ai-communication-type-participation-cancelled',
            },
        } as const;
    }

    override get exampleParameters() {
        return {
            author: kAuthorContextExampleParameters,
            event: kEventContextExampleParameters,
            recipient: kRecipientContextExampleParameters,
            team: kTeamContextExampleParameters,
        };
    }

    override getSubject(params: ParticipationCancelledPromptParameters, language: Language) {
        switch (language) {
            case 'Dutch':
                return `Deelname in ${params.event.shortName} ${params.team.title}`;

            case 'English':
                return `${params.event.shortName} ${params.team.title} participation`;
        }
    }
}
