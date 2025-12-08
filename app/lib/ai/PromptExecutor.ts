// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ModelTextResponse } from '@lib/integrations/genai/Client';
import type { Prompt } from './Prompt';
import { PromptValidator } from './PromptValidator';
import { SystemPrompt } from './prompts';
import { Temporal } from '@lib/Temporal';
import { createAiClient } from '@lib/integrations/genai';
import { readExampleMessages } from './ExampleMessages';

/**
 * Helper type to get the parameters that are expected by a particular kind of prompt.
 */
type GetPromptParameters<T> = T extends Prompt<infer U> ? U : never;

/**
 * Global text encoder instance that will be used by the prompt executor.
 */
const kTextEncoder = new TextEncoder();

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

    #exampleMessages: string[] | null;
    #systemPrompt: string | null;

    private constructor(prompt: T) {
        this.#prompt = prompt;

        this.#exampleMessages = null;
        this.#systemPrompt = null;
    }

    /**
     * Prepares the list of example messages that should be included with the prompt, to help the
     * model write in the same style as the person they're pretending to be. When |userId| is not
     * set, or when they don't have personalised messages, default example messages will be used.
     *
     * @param userId Unique ID of the user for whom to personalise the prompt.
     */
    async prepareExampleMessages(userId?: number) {
        this.#exampleMessages ??= await readExampleMessages(userId);
    }

    /**
     * Executes the system prompt with the given |parameters|. All parameters have sensible defaults
     * so it's entirely valid to execute a prompt without explicitly setting up the system prompt.
     *
     * @param parameters (Partial) parameters made available to the system prompt
     */
    async prepareSystemPrompt(parameters: Partial<GetPromptParameters<SystemPrompt>>) {
        const systemPrompt = new SystemPrompt();
        this.#systemPrompt = await systemPrompt.evaluate({
            date: Temporal.Now.plainDateISO().toString(),
            language: 'English',
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
        if (this.#exampleMessages === null)
            await this.prepareExampleMessages();

        if (this.#systemPrompt === null)
            await this.prepareSystemPrompt({ /* use default values */ });

        const prompt = await this.#prompt.evaluate(parameters);

        const client = await createAiClient();
        return await client.generateText({
            attachments: this.#exampleMessages?.map(exampleMessage => ({
                bytes: kTextEncoder.encode(exampleMessage),
                mimeType: 'text/plain',
            })),
            prompt,
            systemPrompt: this.#systemPrompt!,
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
