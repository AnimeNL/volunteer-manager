// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Prompt } from '../Prompt';

/**
 * Parameters accepted by this prompt.
 */
type TeamChangePromptParameters = {

}

/**
 * This prompt generates an e-mail message to send when someone's team has been changed.
 */
export class TeamChangePrompt extends Prompt<TeamChangePromptParameters> {
    override get metadata() {
        return {
            id: 'team-change',
            label: 'Team change confirmation',
            description: 'Message to confirm that someone\'s been moved to another team.',
            setting: 'ai-communication-type-team-change',
        } as const;
    }

    override get exampleParameters() {
        return {
            
        };
    }
}
