// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Prompt } from './Prompt';

/**
 * Verdict that will be issued by the validator after inspecting a prompt.
 */
interface PromptValidatorVerdict {
    /**
     * Whether the prompt is alright and can safely be used.
     */
    ok: boolean;

    /**
     * Zero or more errors that were identified in the prompt.
     */
    errors: string[];
}

/**
 * This class takes a Prompt instance and validates its correctness based on the information that's
 * available, i.e. the template, parameters and metadata. It comes to a single verdict, and has the
 * ability to output one or more errors that can be communicated to the user.
 */
export class PromptValidator<T extends Prompt<any>> {
    /**
     * Creates a new validator for the given |prompt|. It will not be executed.
     */
    static forPrompt<T extends Prompt<any>>(prompt: T): PromptValidator<T> {
        return new PromptValidator(prompt);
    }

    // ---------------------------------------------------------------------------------------------

    #prompt: T;

    private constructor(prompt: T) {
        this.#prompt = prompt;
    }

    /**
     * Validates the prompt wrapped by this validator.
     */
    async validate(): Promise<PromptValidatorVerdict> {
        const verdict: PromptValidatorVerdict = {
            ok: true,
            errors: [ /* no errors yet */ ],
        };

        // -----------------------------------------------------------------------------------------
        // Confirm validity of the template the prompt is based on.
        // -----------------------------------------------------------------------------------------
        {
            const template = await this.#prompt.template;
            if (!template.ok) {
                verdict.ok = false;
                verdict.errors.push(...template.errors);
            }
        }

        // -----------------------------------------------------------------------------------------
        // Confirm validity of the parameters that are expected by the prompt, and match those
        // against the ones referred to in the template.
        // -----------------------------------------------------------------------------------------
        {
            const template = await this.#prompt.template;

            const exampleParameters = this.#prompt.parameters;
            const templateParameters = new Set(template.parameters);

            for (const parameter of templateParameters) {
                if (exampleParameters.has(parameter))
                    continue;

                verdict.ok = false;
                verdict.errors.push(`Template references an undefined parameter: "${parameter}".`);
            }
        }

        return verdict;
    }
}
