// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Prompt } from '../Prompt';

/**
 * Parameters accepted by this prompt.
 */
type ApplicationRejectedPromptParameters = {

}

/**
 * This prompt generates an e-mail message to send when an application has been rejected.
 */
export class ApplicationRejectedPrompt extends Prompt<ApplicationRejectedPromptParameters> {
    override get metadata() {
        return {
            id: 'application-rejected',
            label: 'Application rejected',
            description: 'Message to announce that someone\'s application has been rejected.',
            setting: 'ai-communication-type-application-rejected',
        } as const;
    }

    override get exampleParameters() {
        return {
            
        };
    }
}
