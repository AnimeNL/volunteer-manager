// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Language } from '../Language';
import { type ActivityContextParameters, kActivityContextExampleParameters } from './context/ActivityContextParameters';
import { type AuthorContextParameters, kAuthorContextExampleParameters } from './context/AuthorContextParameters';
import { type EventContextParameters, kEventContextExampleParameters } from './context/EventContextParameters';
import { Prompt } from '../Prompt';
import { type RecipientContextParameters, kRecipientContextExampleParameters } from './context/RecipientContextParameters';

/**
 * Parameters accepted by this prompt.
 */
type ProgramActivityHelpRequestCheckInPromptParameters =
    ActivityContextParameters & AuthorContextParameters & EventContextParameters &
    RecipientContextParameters;

/**
 * This prompt generates an e-mail message to check in with an activity owner that requested help to
 * see what we can do for them.
 */
export class ProgramActivityHelpRequestCheckInPrompt
    extends Prompt<ProgramActivityHelpRequestCheckInPromptParameters>
{
    override get metadata() {
        return {
            id: 'program-activity-help-request-check-in',
            type: 'Communication',
            label: 'Program activity help request check-in',
            regarding: 'their activity help request',
            description:
                'Message to check in with an activity owner that requested help to see what we ' +
                'can do for them.',
            settings: {
                prompt: 'ai-communication-type-program-activity-help-request-check-in',
            },
        } as const;
    }

    override get exampleParameters() {
        return {
            activity: kActivityContextExampleParameters,
            author: kAuthorContextExampleParameters,
            event: kEventContextExampleParameters,
            recipient: kRecipientContextExampleParameters,
        };
    }

    override getSubject(
        params: ProgramActivityHelpRequestCheckInPromptParameters, language: Language)
    {
        switch (language) {
            case 'Dutch':
                return `${params.activity.title} op ${params.event.shortName}`;

            case 'English':
                return `${params.activity.title} at ${params.event.shortName}`;
        }
    }
}
