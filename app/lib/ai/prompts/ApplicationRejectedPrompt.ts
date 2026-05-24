// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Language } from '../Language';
import { Prompt } from '../Prompt';

import { type TeamCommunicationParameters, kTeamCommunicationExampleParameters }
    from './TeamCommunication';

/**
 * Parameters accepted by this prompt.
 */
type ApplicationRejectedPromptParameters = TeamCommunicationParameters;

/**
 * This prompt generates an e-mail message to send when an application has been rejected.
 */
export class ApplicationRejectedPrompt extends Prompt<ApplicationRejectedPromptParameters> {
    override get metadata() {
        return {
            id: 'application-rejected',
            type: 'Communication',
            label: 'Application rejected',
            description: 'Message to announce that someone\'s application has been rejected.',
            settings: {
                prompt: 'ai-communication-type-application-rejected',
            },
        } as const;
    }

    override get exampleParameters() {
        return kTeamCommunicationExampleParameters;
    }

    override getSubject(params: ApplicationRejectedPromptParameters, language: Language) {
        switch (language) {
            case 'Dutch':
                return `Aanmelding voor ${params.event.shortName} ${params.team.title}`;

            case 'English':
                return `Your ${params.event.shortName} ${params.team.title} application`;
        }
    }
}
