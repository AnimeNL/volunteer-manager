// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Prompt } from '../Prompt';

/**
 * Parameters accepted by this prompt.
 */
type PersonalityDescriptionPromptParameters = {
    input: string;
}

/**
 * Messages that are used as example input to the Personality Description prompt.
 */
const kExampleMessages = JSON.stringify([
// -------------------------------------------------------------------------------------------------
`Dear Marcus,

We have an incredible lineup for this weekend's Summer Festival, and your background in event coordination is exactly what we need to make it unforgettable! I would absolutely love to have your energy on the team, so let me know if you're free for a quick call to lock in your spot.

Best regards,
Sarah Jenkins`,
// -------------------------------------------------------------------------------------------------
`Hi Elena,

Our upcoming Shelter Adoption Day is shaping up to be our biggest event yet, and we are looking for passionate animal lovers like you to help it run smoothly! We have a few prime morning shifts still open, and I know your enthusiasm would bring so much joy to both the pets and our visitors.

Cheers,
David Chen`,
// -------------------------------------------------------------------------------------------------
`Dear Jordan,

I am thrilled to launch our new after-school STEM mentorship program, and your technical skills make you the perfect match to inspire these bright young minds! We are holding a quick orientation next Tuesday, and I would be absolutely delighted to welcome you to the team.

Cheers,
Amanda Ross`,
// -------------------------------------------------------------------------------------------------
]);

/**
 * This is the prompt that's used to summarise someone's writing personality based on the example
 * messages that they've uploaded, so that the other communication models can aim to replicate it.
 */
export class PersonalityDescriptionPrompt extends Prompt<PersonalityDescriptionPromptParameters> {
    override get metadata() {
        return {
            id: 'personality-description-prompt',
            type: 'Feature',
            label: 'Writing Personality Prompt',
            description: 'Generates a clear personality description based on example messages.',
            setting: 'ai-personality-description-prompt',
            settingComplexity: 'ai-personality-description-prompt-complexity',
        } as const;
    }

    override get exampleParameters() {
        return {
            input: kExampleMessages,
        };
    }
}
