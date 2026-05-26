// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Language } from '../Language';
import { type AuthorContextParameters, kAuthorContextExampleParameters } from './context/AuthorContextParameters';
import { type EventContextParameters, kEventContextExampleParameters } from './context/EventContextParameters';
import { Prompt } from '../Prompt';
import { type RecipientContextParameters, kRecipientContextExampleParameters } from './context/RecipientContextParameters';
import { type TeamContextParameters, kTeamContextAlternativeExampleParameters, kTeamContextExampleParameters } from './context/TeamContextParameters';

/**
 * Parameters accepted by this prompt.
 */
type TeamChangePromptParameters =
    AuthorContextParameters & EventContextParameters & RecipientContextParameters &
    TeamContextParameters<'oldTeam'> & TeamContextParameters<'newTeam'>;

/**
 * This prompt generates an e-mail message to send when someone's team has been changed.
 */
export class TeamChangePrompt extends Prompt<TeamChangePromptParameters> {
    override get metadata() {
        return {
            id: 'team-change',
            type: 'Communication',
            label: 'Team change confirmation',
            regarding: 'changing their team',
            description: 'Message to confirm that someone\'s been moved to another team.',
            settings: {
                prompt: 'ai-communication-type-team-change',
            },
        } as const;
    }

    override get exampleParameters() {
        return {
            author: kAuthorContextExampleParameters,
            event: kEventContextExampleParameters,
            recipient: kRecipientContextExampleParameters,
            oldTeam: kTeamContextExampleParameters,
            newTeam: kTeamContextAlternativeExampleParameters,
        };
    }

    override getSubject(params: TeamChangePromptParameters, language: Language) {
        switch (language) {
            case 'Dutch':
                return `Verandering in je ${params.event.shortName} deelname`;

            case 'English':
                return `Update on your ${params.event.shortName} participation`;
        }
    }
}
