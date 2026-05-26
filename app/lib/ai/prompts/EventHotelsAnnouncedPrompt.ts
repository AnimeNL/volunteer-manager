// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Language } from '../Language';
import { Prompt } from '../Prompt';

import { type TeamCommunicationParameters, kTeamCommunicationExampleParameters }
    from './TeamCommunication';

/**
 * Parameters accepted by this prompt.
 */
type EventHotelsAnnouncedPromptParameters = TeamCommunicationParameters;

/**
 * This prompt generates an e-mail message to send when the hotels for an event have been announced.
 */
export class EventHotelsAnnouncedPrompt extends Prompt<EventHotelsAnnouncedPromptParameters> {
    override get metadata() {
        return {
            id: 'event-hotels-announced',
            type: 'Communication',
            label: 'Hotel information announcement',
            regarding: 'hotel information',
            description: 'Message to announce when hotel information has been publicly announced.',
            settings: {
                prompt: 'ai-communication-type-event-hotels-announced',
            },
        } as const;
    }

    override get exampleParameters() {
        return kTeamCommunicationExampleParameters;
    }

    override getSubject(params: EventHotelsAnnouncedPromptParameters, language: Language) {
        switch (language) {
            case 'Dutch':
                return `Aankondiging ${params.event.name}`;

            case 'English':
                return `Announcing ${params.event.shortName}`;
        }
    }
}
