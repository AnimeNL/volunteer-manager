// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Prompt } from '../Prompt';

/**
 * Parameters accepted by this prompt.
 */
type ParticipationReinstatedPromptParameters = {

}

/**
 * This prompt generates an e-mail message to send when someone's participation has been reinstated.
 */
export class ParticipationReinstatedPrompt extends Prompt<ParticipationReinstatedPromptParameters> {
    override get metadata() {
        return {
            id: 'participation-reinstated',
            label: 'Participation reinstated',
            description: 'Message to confirm that someone will once again be participating.',
            setting: 'ai-communication-type-participation-reinstated',
        } as const;
    }

    override get exampleParameters() {
        return {
            
        };
    }
}
