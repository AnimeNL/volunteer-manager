// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ModelTextResponse } from '@lib/integrations/genai/Client';
import type { Prompt } from './Prompt';
import { PromptValidator } from './PromptValidator';
import { createAiClient } from '@lib/integrations/genai';
import { readSetting } from '@lib/Settings';

/**
 * Helper type to get the parameters that are expected by a particular kind of prompt.
 */
type GetPromptParameters<T> = T extends Prompt<infer U> ? U : never;

/**
 * The executor has the ability to actually execute a prompt, either using an existing client or
 * creating a client of its own.
 */
export class PromptExecutor<T extends Prompt<any>> {
    /**
     * Creates a new executor for the given |prompt|.
     */
    static forPrompt<T extends Prompt<any>>(prompt: T): PromptExecutor<T> {
        return new PromptExecutor(prompt);
    }

    // ---------------------------------------------------------------------------------------------

    #prompt: T;
    #systemPrompt: string | null | undefined;

    private constructor(prompt: T) {
        this.#prompt = prompt;
        this.#systemPrompt = null;
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
        if (this.#systemPrompt === null)
            this.#systemPrompt = await readSetting('ai-communication-system-prompt');

        const prompt = await this.#prompt.evaluate(parameters);

        const client = await createAiClient();
        return await client.generateText({
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
