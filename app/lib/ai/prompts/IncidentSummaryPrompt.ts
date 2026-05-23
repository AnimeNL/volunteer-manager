// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Prompt } from '../Prompt';

/**
 * Parameters accepted by this prompt.
 */
type IncidentSummaryPromptParameters = {
    incident: string;
}

/**
 * This is the prompt used to generate a summary for a given incident report, intended to be used
 * both for making it more concise, and ensuring that any sensitive information is removed.
 */
export class IncidentSummaryPrompt extends Prompt<IncidentSummaryPromptParameters> {
    override get metadata() {
        return {
            id: 'incident-summary-prompt',
            type: 'Feature',
            label: 'Incident Summary Prompt',
            description: 'Prompt used to filter and summarise incident reports.',
            settings: {
                complexity: 'ai-incident-summary-prompt-complexity',
                prompt: 'ai-incident-summary-prompt',
            },
        } as const;
    }

    override get exampleParameters() {
        return {
            incident:
                'John Doe was found in the bathroom near the north side of the main theatre ' +
                'where he left the tap running, which in turn ended up flooding the bathroom!',
        };
    }
}
