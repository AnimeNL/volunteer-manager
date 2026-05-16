// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Prompt } from '../Prompt';

/**
 * Parameters accepted by this prompt.
 */
type DutyBookSummaryPromptParameters = {
    event: string;
    input: string;
    team: string;
}

/**
 * This is the prompt used to generate a summary for an event's Duty Book, specialised by event and
 * (optionally) team. The results of this are only available to team leaders.
 */
export class DutyBookSummaryPrompt extends Prompt<DutyBookSummaryPromptParameters> {
    override get metadata() {
        return {
            id: 'duty-book-summary-prompt',
            type: 'Feature',
            label: 'Duty Book Summary Prompt',
            description: 'Prompt used to holistically summarise Duty Book entries.',
            setting: 'ai-duty-book-summary-prompt',
            settingComplexity: 'ai-duty-book-summary-prompt-complexity',
        } as const;
    }

    override get exampleParameters() {
        return {
            event: 'AnimeCon 2026: Hidden Spirits',
            input: '["First entry", "Second entry"]',
            team: 'Stewards',
        };
    }
}
