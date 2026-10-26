// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Language } from '../Language';
import { type AuthorContextParameters, kAuthorContextExampleParameters } from './context/AuthorContextParameters';
import { type EventContextParameters, kEventContextExampleParameters } from './context/EventContextParameters';
import { type HotelBookingContextParameters, kHotelBookingContextExampleParameters } from './context/HotelBookingContextParameters';
import { Prompt } from '../Prompt';
import { type RecipientContextParameters, kRecipientContextExampleParameters } from './context/RecipientContextParameters';
import { type TeamContextParameters, kTeamContextExampleParameters } from './context/TeamContextParameters';

/**
 * Parameters accepted by this prompt.
 */
type HotelConfirmationPromptParameters =
    AuthorContextParameters & EventContextParameters & HotelBookingContextParameters &
    RecipientContextParameters & TeamContextParameters;

/**
 * This prompt will be used when confirming a hotel reservation to a volunteer.
 */
export class HotelConfirmationPrompt extends Prompt<HotelConfirmationPromptParameters> {
    override get metadata() {
        return {
            id: 'hotel-confirmation',
            type: 'Communication',
            label: 'Hotel confirmation',
            regarding: 'their hotel reservation',
            description:
                'Message to confirm to a volunteer that their hotel booking has been settled.',
            settings: {
                prompt: 'ai-communication-type-hotel-confirmation',
            },
        } as const;
    }

    override get exampleParameters() {
        return {
            author: kAuthorContextExampleParameters,
            event: kEventContextExampleParameters,
            hotel: kHotelBookingContextExampleParameters,
            recipient: kRecipientContextExampleParameters,
            team: kTeamContextExampleParameters,
        };
    }

    override getSubject(params: HotelConfirmationPromptParameters, language: Language) {
        switch (language) {
            case 'Dutch':
                return `Hotelreservering voor ${params.event.shortName}`;

            case 'English':
                return `Hotel reservation for ${params.event.shortName}`;
        }
    }
}
