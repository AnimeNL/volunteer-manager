// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Prompt } from '../Prompt';

/**
 * Parameters accepted by this prompt.
 */
type NardoPersonalisedAdvicePromptParameters = {
    additionalContext: string;
    advice: string;
    audience: {
        name: string;
        tenure: number;
    };
    date: string;
    event: {
        name: string;
        location: string;
        startDate: string;
        endDate: string;
    };
}

/**
 * This prompt generates personalised advice on behalf of a Del a Rie Advies representative.
 */
export class NardoPersonalisedAdvicePrompt extends Prompt<NardoPersonalisedAdvicePromptParameters> {
    override get metadata() {
        return {
            id: 'nardo-personalised-advice',
            label: 'Personalised Advice (Del a Rie Advies)',
            description: 'Generated personal advice from the Del a Rie Advies consultancy firm.',
            setting: 'ai-nardo-personalised-advice',
        } as const;
    }

    override get exampleParameters() {
        return {
            additionalContext: /* none */ '',
            advice: 'Use old manga as wallpaper to give any room instant "otaku chic".',
            audience: {
                name: 'John',
                tenure: 6,
            },
            date: '2026-04-19',
            event: {
                name: 'AnimeCon 2026',
                location: 'De Broodfabriek, Rijswijk',
                startDate: '2026-04-17',
                endDate: '2026-04-19',
            },
        };
    }
}
