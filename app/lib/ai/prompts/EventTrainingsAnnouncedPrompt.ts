// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Language } from '../Language';
import { Prompt } from '../Prompt';

import { type TeamCommunicationParameters, kTeamCommunicationExampleParameters }
    from './TeamCommunication';

/**
 * Parameters accepted by this prompt.
 */
type EventTrainingsAnnouncedPromptParameters = TeamCommunicationParameters;

/**
 * This prompt generates an e-mail message to send when the dates for an event have been announced.
 */
export class EventTrainingsAnnouncedPrompt extends Prompt<EventTrainingsAnnouncedPromptParameters> {
    override get metadata() {
        return {
            id: 'event-trainings-announced',
            type: 'Communication',
            label: 'Training information announcement',
            description: 'Message to announce when training information has been announced.',
            settings: {
                prompt: 'ai-communication-type-event-trainings-announced',
            },
        } as const;
    }

    override get exampleParameters() {
        return kTeamCommunicationExampleParameters;
    }

    override getSubject(params: EventTrainingsAnnouncedPromptParameters, language: Language) {
        switch (language) {
            case 'Dutch':
                return `Aankondiging ${params.event.name}`;

            case 'English':
                return `Announcing ${params.event.shortName}`;
        }
    }
}
