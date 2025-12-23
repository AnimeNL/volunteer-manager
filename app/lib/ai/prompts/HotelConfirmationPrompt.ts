// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

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
 * This prompt will be used when reminding people who volunteered in past years, but haven't yet
 * applied ot participate in the latest event, to apply again in case they're still interested.
 */
export class HotelConfirmationPrompt extends Prompt<HotelConfirmationPromptParameters> {
    override get metadata() {
        return {
            id: 'hotel-confirmation',
            label: 'Hotel confirmation',
            description:
                'Message to confirm to a volunteer that their hotel booking has been settled.',
            setting: 'ai-communication-type-hotel-confirmation',
        } as const;
    }

    override get exampleParameters() {
        return {
            ...kAuthorContextExampleParameters,
            ...kEventContextExampleParameters,
            ...kHotelBookingContextExampleParameters,
            ...kRecipientContextExampleParameters,
            ...kTeamContextExampleParameters,
        };
    }
}
