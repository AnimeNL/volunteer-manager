// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Prompt } from '../Prompt';
import { Temporal } from '@lib/Temporal';

/**
 * Parameters accepted by this prompt.
 */
type SystemPromptParameters = {
    date: string;
    language: string;
}

/**
 * This is the system prompt that will be included with all generated messages, which describes the
 * personality, approach, input and output that the model should be expecting.
 */
export class SystemPrompt extends Prompt<SystemPromptParameters> {
    override get metadata() {
        return {
            id: 'system-prompt',
            hidden: true,
            label: 'System Prompt',
            description: 'System prompt used for all communication messages.',
            setting: 'ai-communication-system-prompt',
        } as const;
    }

    override get exampleParameters() {
        return {
            date: Temporal.Now.plainDateISO().toString(),
            language: 'English',
        };
    }
}
