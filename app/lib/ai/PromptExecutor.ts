// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ModelTextResponse } from '@lib/integrations/genai/Client';
import type { Prompt } from './Prompt';
import { PromptValidator } from './PromptValidator';
import { SystemPrompt } from './prompts';
import { Temporal } from '@lib/Temporal';
import { createAiClient } from '@lib/integrations/genai';
import { readUserSetting } from '@lib/UserSettings';

/**
 * Helper type to get the parameters that are expected by a particular kind of prompt.
 */
export type GetPromptParameters<T> = T extends Prompt<infer U> ? U : never;

/**
 * The executor has the ability to actually execute a prompt, either using an existing client or
 * creating a client of its own. It is able to execute prompts of all kinds. Communication prompts
 * have one requirement, which is that they must have a system prompt attached to them to channel
 * the personality of the messages we intend to distribute through the system.
 */
export class PromptExecutor<T extends Prompt<any>> {
    /**
     * Creates a new executor for the given |prompt|.
     */
    static forPrompt<T extends Prompt<any>>(prompt: T): PromptExecutor<T> {
        return new PromptExecutor(prompt);
    }

    // ---------------------------------------------------------------------------------------------

    #systemPrompt: string | undefined;
    #prompt: T;

    private constructor(prompt: T) {
        this.#prompt = prompt;
    }

    /**
     * Prepares the communication system prompt with the given |parameters|. All parameters have
     * sensible defaults so it's entirely valid to execute a prompt without explicitly setting up
     * the system prompt. When available, personalised personality prompts will be used.
     *
     * @param userId Unique ID of the user for whom this prompt is being executed.
     * @param parameters (Partial) parameters made available to the system prompt.
     */
    async addSystemPrompt(userId: number, parameters: Partial<GetPromptParameters<SystemPrompt>>) {
        const personalityPrompt =
            parameters.personalityPrompt ??
                await readUserSetting(userId, 'ai-communication-personality-prompt');

        const systemPrompt = new SystemPrompt();
        this.#systemPrompt = await systemPrompt.evaluate({
            date: Temporal.Now.plainDateISO().toString(),
            language: 'English',
            personalityPrompt: personalityPrompt!,
            ...parameters,
        });
    }

    /**
     * Executes the prompt owned by this instance with the given |parameters|.
     *
     * Executing a prompt may cause multiple database lookups, as well as API calls to external
     * services that incur both latency and a financial cost. Prompt execution should be done
     * sparingly, as and when a need for it arises.
     *
     * It's strongly recommended to confirm with the `validate()` method that the prompt is ready
     * for use. Continuing with an invalid prompt may yield unexpected results, as the model may not
     * be aware of what it's expected to do.
     *
     * @param parameters Parameters necessary to complete the prompt's template.
     * @returns Response from the model as it executed the prompt.
     */
    async execute(parameters: GetPromptParameters<T>): Promise<ModelTextResponse> {
        if (this.#prompt.metadata.type === 'Communication' && !this.#systemPrompt)
            throw new Error('Communication prompts must have a system propt set up.');

        const prompt = await this.#prompt.evaluate(parameters);

        const client = await createAiClient();
        return await client.safeGenerateText({
            complexity: this.#prompt.complexity,
            prompt,
            systemPrompt: this.#systemPrompt,
        });
    }

    /**
     * Validates that the prompt owned by this executor is valid. It runs the PromptValidator on the
     * instance, which validates that there are no unexpected parameters or incorrect conditions.
     */
    async validate(): Promise<boolean> {
        const validator = PromptValidator.forPrompt(this.#prompt);
        const verdict = await validator.validate();

        return verdict.ok;
    }
}
