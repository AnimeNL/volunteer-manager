// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Prompt } from '../Prompt';

/**
 * Parameters accepted by this prompt.
 */
type HotelConfirmationPromptParameters = {
    name: string;
}

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
            name: 'example',
        };
    }
}
