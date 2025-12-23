// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type AuthorContextParameters, kAuthorContextExampleParameters } from './AuthorContextParameters';
import { type EventContextParameters, kEventContextExampleParameters } from './EventContextParameters';
import { Prompt } from '../Prompt';
import { type RecipientContextParameters, kRecipientContextExampleParameters } from './RecipientContextParameters';
import { type TeamContextParameters, kTeamContextExampleParameters } from './TeamContextParameters';
import { type TeamInviteKeyContextParameters , kTeamInviteKeyContextExampleParameters} from './TeamInviteKeyContextParameters';

/**
 * Parameters accepted by this prompt.
 */
type RetentionPromptParameters =
    AuthorContextParameters & EventContextParameters & RecipientContextParameters &
    TeamContextParameters & TeamInviteKeyContextParameters;

/**
 * This prompt will be used when reminding people who volunteered in past years, but haven't yet
 * applied ot participate in the latest event, to apply again in case they're still interested.
 */
export class RetentionPrompt extends Prompt<RetentionPromptParameters> {
    override get metadata() {
        return {
            id: 'retention',
            label: 'Participation reminder',
            description: 'Message to remind volunteers to participate again in the latest event.',
            setting: 'ai-communication-type-retention',
        } as const;
    }

    override get exampleParameters() {
        return {
            ...kAuthorContextExampleParameters,
            ...kEventContextExampleParameters,
            ...kRecipientContextExampleParameters,
            ...kTeamContextExampleParameters,
            ...kTeamInviteKeyContextExampleParameters,
        };
    }
}
