// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Prompt } from '../Prompt';

/**
 * Parameters accepted by this prompt.
 */
type ParticipationCancelledPromptParameters = {

}

/**
 * This prompt generates an e-mail message to send when a volunteer's participation is cancelled.
 */
export class ParticipationCancelledPrompt extends Prompt<ParticipationCancelledPromptParameters> {
    override get metadata() {
        return {
            id: 'participation-cancelled',
            label: 'Participation cancelled',
            description: 'Message to confirm that someone\'s participation has been cancelled.',
            setting: 'ai-communication-type-participation-cancelled',
        } as const;
    }

    override get exampleParameters() {
        return {
            
        };
    }
}
