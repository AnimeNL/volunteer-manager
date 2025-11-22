// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Types that are valid for parameters given to a prompt.
 */
type PromptParameter = boolean | number | string;

/**
 * Nested variant of the |PromptParameter| set of types.
 */
type NestedPromptParameter = { [key: string]: PromptParameter | NestedPromptParameter };

/**
 * Available directives that the compile function is able to tokenize a prompt into.
 */
type PromptDirective =
    { directive: 'conditionStart'; expression: string } |
    { directive: 'conditionElse' } |
    { directive: 'conditionEnd' } |
    { directive: 'unknown', text: string };

/**
 * Available tokens that the compile function is able to tokenize a prompt into.
 */
type PromptToken = string | { parameter: string } | PromptDirective;

/**
 * A prompt exists of one or more individual tokens.
 */
type PromptTokens = PromptToken[];

/**
 * Regular expression used to validate that a parameter's name is valid. We allow A-Z regardless of
 * casing, and periods to indicate the need to dive into an object.
 */
const kParameterNameValidator = /^[a-zA-Z\.]+$/;

/**
 * Value to use when a given parameter name resolves to an object.
 */
const kParameterObject = '[object]';

/**
 * Value to use when a given parameter name cannot be resolved on the passed arguments.
 */
const kParameterUndefined = '[undefined]';

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
            throw new Error(`PromptParser::compile expected a string, got a ${typeof rawPrompt}`);

        const errors: string[] = [ /* no errors yet */ ];
        const tokens: PromptTokens = [ /* no tokens yet */ ];
        let buffer: string = '';

        for (let index = 0; index < rawPrompt.length;) {
            const char = rawPrompt[index];
            const pair = char + (rawPrompt[index] || '');

            if (pair === '{{' || pair === '[[') {
                if (buffer.length > 0) {
                    tokens.push(buffer);
                    buffer = '';
                }

                const end = pair === '{{' ? '}}' : ']]';

                const startIndex = index + 2;
                const endIndex = rawPrompt.indexOf(end, startIndex);

                if (endIndex < 0) {
                    errors.push(`Missing parameter closing token ("${end}") at index ${index}`);
                    break;  // cannot continue
                }

                if (endIndex === startIndex) {
                    errors.push(`Missing parameter name at index ${startIndex}`);
                    break;  // cannot continue
                }

                if (pair === '{{') {
                    const parameter = rawPrompt.substring(startIndex, endIndex);
                    if (!kParameterNameValidator.test(parameter)) {
                        errors.push(
                            `Invalid parameter name ("${parameter}") at index ${startIndex}`);
                    } else {
                        tokens.push({ parameter });
                    }
                } else {
                    const directive =
                        this.compileDirective(rawPrompt.substring(startIndex, endIndex));
                    if (directive.directive === 'unknown') {
                        errors.push(
                            `Invalid directive ("${directive.text}") at index ${startIndex}`);
                    }

                    tokens.push(directive);
                }

                index = endIndex + end.length;
                continue;
            }

            buffer += char;
            index++;
        }

        if (buffer.length > 0)
            tokens.push(buffer);

        // TODO: Ensure that if/else/nif are balanced.

        return new PromptParser(errors, tokens);
    }

    /**
     * Compiles the given |rawDirective| into a prompt token. Various sorts of directives are
     * supported, where unknown ones will fall into a canonical "unknownDirective" directive.
     */
    private static compileDirective(rawDirective: string): PromptDirective {
        if (rawDirective.startsWith('if')) {
            // TODO: Parse the expression to populate the left and (optional) right hand sides
            // TODO: Parse the expression to populate eq/gt/ge/lt/le/ne comparisons
            return { directive: 'conditionStart', expression: rawDirective.substring(2).trim() };
        }

        if (rawDirective.startsWith('else'))
            return { directive: 'conditionElse' };

        if (rawDirective.startsWith('/if'))
            return { directive: 'conditionEnd' };

        return { directive: 'unknown', text: rawDirective };
    }

    // ---------------------------------------------------------------------------------------------

    readonly #ok: boolean;

    readonly #errors: string[];
    readonly #parameters: string[]
    readonly #tokens: PromptTokens;

    private constructor(errors: string[], tokens: PromptTokens) {
        this.#ok = !errors.length;

        this.#errors = errors;
        this.#tokens = tokens;

        const parameters = new Set<string>();
        for (const token of this.#tokens) {
            if (typeof token === 'object' && 'parameter' in token)
                parameters.add(token.parameter);
        }

        this.#parameters = [ ...parameters ].sort();
    }

    /**
     * Returns whether this parser represents a prompt that can be evaluated.
     */
    get ok() { return this.#ok; }

    /**
     * Returns the errors that occurred during compilation. Chronologically sorted.
     */
    get errors() { return this.#errors; }

    /**
     * Returns the substitution parameters that evaluation is expecting. Alphabetically sorted.
     */
    get parameters() { return [ ...this.#parameters ]; }

    /**
     * Evaluates the compiled prompt, and returns the result as a string. The |args| can be passed
     * to substitute placeholders made available in the prompt.
     */
    evaluate(args?: NestedPromptParameter): string {
        const result: string[] = [ /* none yet */ ];
        for (const token of this.#tokens) {
            if (typeof token === 'string') {
                result.push(token);
                continue;
            }

            if ('parameter' in token) {
                const parameterValue = this.evaluteResolveParameter(token.parameter, args);

                result.push(`${parameterValue ?? kParameterUndefined}`);
                continue;
            }
        }

        return result.join('');
    }

    /**
     * Resolves the given |parameter| in the set of |args|, based on its name and periods as the
     * character used to separate levels of nesting. Only dictionaries are supported.
     */
    private evaluteResolveParameter(parameter: string, args?: NestedPromptParameter) {
        if (!args)
            return undefined;

        const path = parameter.split('.');

        let currentRoot = args;
        for (const component of path) {
            if (!(component in currentRoot))
                return undefined;

            const value = currentRoot[component];
            if (typeof value !== 'object')
                return value;

            currentRoot = value;
        }

        return kParameterObject;
    }
}
