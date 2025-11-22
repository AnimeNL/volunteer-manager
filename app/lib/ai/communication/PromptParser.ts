// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Available tokens that the compile function is able to tokenize a prompt into.
 */
type CompiledPromptToken =
    string |
    { parameter: string } |
    { conditionalStart: string } |
    { conditionalElse: true } |
    { conditionalEnd: true } |
    { unknownDirective: string };

/**
 * A compiled prompt exists of one or more individual chunks.
 */
type CompiledPrompt = CompiledPromptToken[];

/**
 * The PromptParser class is a mechanism to take a raw prompt with our pseudo-syntax and transform
 * it into a composed form. This is done in two steps, first a compile() step, which extracts the
 * expected parameters, and an evaluate() step which injects them and composes the prompt.
 * 
 * Prompts will be validated, and the evaluate() method will fail on any prompt that cannot compile
 * successfully. An instance will still be returned as it provides diagnostics information.
 *
 * Feature: Substitution parameters
 *
 *     List the ten most significant happening in the year {{year}}.
 *
 * Feature: Conditionals
 *
 *     List the ten most significant happening in the past ten years.
 *     [[if onlySports]]
 *       Only consider sports events.
 *     [[else]]
 *       Consider all sorts of events.
 *     [[/if]]
 */
export class PromptParser {
    /**
     * Compiles the given |rawPrompt| and returns a PromptParser instance. The |ok| property of the
     * instance must be checked prior to attempting to evaluate the prompt.
     */
    static compile(rawPrompt: string): PromptParser {
        if (typeof rawPrompt !== 'string')
            throw new Error(`PromptParser::compile expected a string, got a ${typeof rawPrompt}.`);

        return new PromptParser([ rawPrompt ]);
    }

    // ---------------------------------------------------------------------------------------------

    readonly #ok: boolean;

    readonly #parameters: string[];
    readonly #prompt: CompiledPrompt;

    private constructor(prompt: CompiledPrompt) {
        this.#ok = true;
        this.#parameters = [ /* none */ ];
        this.#prompt = prompt;
    }

    /**
     * Returns whether this parser represents a prompt that can be evaluated.
     */
    get ok() { return this.#ok; }

    /**
     * Returns the substitution parameters that evaluation is expecting.
     */
    get parameters() { return this.#parameters; }

    /**
     * Evaluates the compiled prompt, and returns the result as a string.
     */
    evaluate(): string {
        return this.#prompt.join('');
    }
}
