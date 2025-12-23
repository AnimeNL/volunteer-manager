// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Prompt } from '../Prompt';

/**
 * Parameters accepted by this prompt.
 */
type ApplicationApprovedPromptParameters = {

}

/**
 * This prompt generates an e-mail message to send when an application has been approved.
 */
export class ApplicationApprovedPrompt extends Prompt<ApplicationApprovedPromptParameters> {
    override get metadata() {
        return {
            id: 'application-approved',
            label: 'Application approved',
            description: 'Message to announce that someone\'s application has been approved.',
            setting: 'ai-communication-type-application-approved',
        } as const;
    }

    override get exampleParameters() {
        return {
            
        };
    }
}
