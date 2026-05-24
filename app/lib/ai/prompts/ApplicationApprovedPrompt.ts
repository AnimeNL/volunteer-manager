// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Language } from '../Language';
import { Prompt } from '../Prompt';

import { type TeamCommunicationParameters, kTeamCommunicationExampleParameters }
    from './TeamCommunication';

/**
 * Parameters accepted by this prompt.
 */
type ApplicationApprovedPromptParameters = TeamCommunicationParameters;

/**
 * This prompt generates an e-mail message to send when an application has been approved.
 */
export class ApplicationApprovedPrompt extends Prompt<ApplicationApprovedPromptParameters> {
    override get metadata() {
        return {
            id: 'application-approved',
            type: 'Communication',
            label: 'Application approved',
            description: 'Message to announce that someone\'s application has been approved.',
            settings: {
                prompt: 'ai-communication-type-application-approved',
            },
        } as const;
    }

    override get exampleParameters() {
        return kTeamCommunicationExampleParameters;
    }

    override getSubject(params: ApplicationApprovedPromptParameters, language: Language) {
        switch (language) {
            case 'Dutch':
                return `Aanmelding voor ${params.event.shortName} ${params.team.title}`;

            case 'English':
                return `Your ${params.event.shortName} ${params.team.title} application`;
        }
    }
}
