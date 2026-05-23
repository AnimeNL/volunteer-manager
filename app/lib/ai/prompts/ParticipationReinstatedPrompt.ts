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
type ParticipationReinstatedPromptParameters =
    AuthorContextParameters & EventContextParameters & RecipientContextParameters &
    TeamContextParameters;

/**
 * This prompt generates an e-mail message to send when someone's participation has been reinstated.
 */
export class ParticipationReinstatedPrompt extends Prompt<ParticipationReinstatedPromptParameters> {
    override get metadata() {
        return {
            id: 'participation-reinstated',
            type: 'Communication',
            label: 'Participation reinstated',
            description: 'Message to confirm that someone will once again be participating.',
            settings: {
                prompt: 'ai-communication-type-participation-reinstated',
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

    override getSubject(params: ParticipationReinstatedPromptParameters, language: Language) {
        switch (language) {
            case 'Dutch':
                return `Deelname in ${params.event.shortName} ${params.team.title}`;

            case 'English':
                return `${params.event.shortName} ${params.team.title} participation`;
        }
    }
}
