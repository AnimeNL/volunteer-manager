// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
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
type HotelPaymentReminderPromptParameters =
    AuthorContextParameters & EventContextParameters & HotelBookingContextParameters &
    RecipientContextParameters & TeamContextParameters;

/**
 * This prompt will be used when reminding a volunteer to pay for their hotel reservation.
 */
export class HotelPaymentReminderPrompt extends Prompt<HotelPaymentReminderPromptParameters> {
    override get metadata() {
        return {
            id: 'hotel-payment-reminder',
            type: 'Communication',
            label: 'Hotel payment reminder',
            regarding: 'their hotel payment',
            description: 'Message to remind a volunteer to pay for their hotel booking.',
            settings: {
                prompt: 'ai-communication-type-hotel-payment-reminder',
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

    override getSubject(params: HotelPaymentReminderPromptParameters, language: Language) {
        switch (language) {
            case 'Dutch':
                return `Hotelreservering voor ${params.event.shortName}`;

            case 'English':
                return `Hotel reservation for ${params.event.shortName}`;
        }
    }
}
