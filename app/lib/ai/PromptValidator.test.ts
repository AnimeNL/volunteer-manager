// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Prompt } from './Prompt';
import { PromptValidator } from './PromptValidator';

describe('PromptValidator', () => {
    it('is able to pass completely fine prompts', async () => {
        type Parameters = { value: 42 };

        class CompletePrompt extends Prompt<Parameters> {
            override get metadata() { return null as any; }
            override get exampleParameters() {
                return {
                    value: 42,
                } as const;
            }
        }

        const promptInstance = new CompletePrompt('{{value}}');
        const promptValidator = PromptValidator.forPrompt(promptInstance);
        const validation = await promptValidator.validate();

        expect(validation.ok).toBeTrue();
        expect(validation.errors).toBeArrayOfSize(0);
    });

    it('is able to identify compile issues with the template', async () => {
        class IncompleteTemplatePrompt extends Prompt<{ /* no parameters */ }> {
            override get metadata() { return null as any; }
            override get exampleParameters() { return {}; }
        }

        const promptInstance = new IncompleteTemplatePrompt('[[if foobar]]');
        const promptValidator = PromptValidator.forPrompt(promptInstance);
        const validation = await promptValidator.validate();

        expect(validation.ok).toBeFalse();
        expect(validation.errors).toIncludeSameMembers([
            'Found one or more unclosed condition blocks.',
            'Template references an undefined parameter: "foobar".',
        ]);
    });

    it('is able to identify incorrectly referred to parameters', async () => {
        type Parameters = { value: 42 };

        class UnknownParameterReferencePrompt extends Prompt<Parameters> {
            override get metadata() { return null as any; }
            override get exampleParameters() {
                return {
                    value: 42,
                } as const;
            }
        }

        const promptInstance = new UnknownParameterReferencePrompt('{{value}}{{context}}');
        const promptValidator = PromptValidator.forPrompt(promptInstance);
        const validation = await promptValidator.validate();

        expect(validation.ok).toBeFalse();
        expect(validation.errors).toIncludeSameMembers([
            'Template references an undefined parameter: "context".'
        ]);
    });

    it('is able to identify incorrectly referred to parameters in conditions', async () => {
        type Parameters = { value: 42 };

        class UnknownParameterConditionReferencePrompt extends Prompt<Parameters> {
            override get metadata() { return null as any; }
            override get exampleParameters() {
                return {
                    value: 42,
                } as const;
            }
        }

        const promptInstance =
            new UnknownParameterConditionReferencePrompt('[[if valeu > 42]]huh[[/if]]');  // typo'd
        const promptValidator = PromptValidator.forPrompt(promptInstance);
        const validation = await promptValidator.validate();

        expect(validation.ok).toBeFalse();
        expect(validation.errors).toIncludeSameMembers([
            'Template references an undefined parameter: "valeu".'
        ]);
    });
});
