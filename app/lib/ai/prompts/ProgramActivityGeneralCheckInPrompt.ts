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
type ProgramActivityGeneralCheckInPromptParameters =
    ActivityContextParameters & AuthorContextParameters & EventContextParameters &
    RecipientContextParameters;

/**
 * This prompt generates an e-mail message to reach out to an activity owner with general questions,
 * or to double check whether anything is necessary.
 */
export class ProgramActivityGeneralCheckInPrompt
    extends Prompt<ProgramActivityGeneralCheckInPromptParameters>
{
    override get metadata() {
        return {
            id: 'program-activity-general-check-in',
            type: 'Communication',
            label: 'Program activity general check-in',
            regarding: 'their program activity',
            description:
                'Message to reach out to an activity owner with general questions, or double ' +
                'checking whether anything is necessary.',
            settings: {
                prompt: 'ai-communication-type-program-activity-general-check-in',
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

    override getSubject(params: ProgramActivityGeneralCheckInPromptParameters, language: Language) {
        switch (language) {
            case 'Dutch':
                return `${params.activity.title} op ${params.event.shortName}`;

            case 'English':
                return `${params.activity.title} at ${params.event.shortName}`;
        }
    }
}
