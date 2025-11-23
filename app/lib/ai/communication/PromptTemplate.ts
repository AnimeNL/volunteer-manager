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
 * Operators that can be evaluated as part of prompt conditions.
 */
type PromptConditionOperator = 'eq' | 'ne' | 'ge' | 'gt' | 'le' | 'lt';

/**
 * Available types for either the left-hand or right-hand side of a condition.
 */
type PromptConditionPart =
    { type: 'boolean', value: boolean } |
    { type: 'number', value: number } |
    { type: 'parameter', value: string } |
    { type: 'string', value: string };

/**
 * Available conditions that the compile function is able to tokenize from a prompt.
 */
type PromptCondition = {
    operator: PromptConditionOperator;
    lhs: PromptConditionPart;
    rhs: PromptConditionPart;
};

/**
 * Available directives that the compile function is able to tokenize a prompt into.
 */
type PromptDirective =
    { directive: 'conditionStart'; condition: PromptCondition } |
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
 * Regular expression used to identify whether a string is a falsy boolean.
 */
const kBooleanFalsyRegexp = /^false$/i;

/**
 * Regular expression used to identify whether a string is a truthy boolean.
 */
const kBooleanTruthyRegexp = /^true$/i;

/**
 * Regular expression used to identify whether a string is a number.
 */
const kNumberRegexp = /^(-?\d+(?:\.\d+)?)$/;

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
 * Regular expression used to identify whether a string is a literal.
 */
const kStringRegexp = /"([^"\\]*(\\.[^"\\]*)*)"|\'([^\'\\]*(\\.[^\'\\]*)*)\'/;

/**
 * The PromptTemplate class is a mechanism to take a raw prompt with our pseudo-syntax and transform
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
 *
 * Conditionals are supported with six operators, as well as two that implicitly convert to one of
 * the formally supported operators. They are:
 *
 *     [[if param]]            - |param| must be truthy
 *     [[if !param]]           - |param| must not be truthy
 *     [[if param == 2026]]    - |param| must be equal to the number 2026
 *     [[if param != "name"]]  - |param| must not be equal to the string "name"
 *     [[if param > 2024]]     - |param| must be larger than 2024
 *     [[if param >= 2025]]    - |param| must be larger than or be equal to 2025
 *     [[if param < 2026]]     - |param| must be smaller than 2026
 *     [[if param <= 2025]]    - |param| must be smaller than or be equal to 2025
 *
 * These faetures are extensively covered by a test suite, and documented in the manager itself.
 */
export class PromptTemplate {
    /**
     * Compiles the given |rawPrompt| and returns a PromptTemplate instance. The |ok| property of
     * the instance must be checked prior to attempting to evaluate the prompt.
     */
    static compile(rawPrompt: string): PromptTemplate {
        if (typeof rawPrompt !== 'string')
            throw new Error(`PromptTemplate::compile expected a string, got a ${typeof rawPrompt}`);

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
                    const parameter = rawPrompt.substring(startIndex, endIndex).trim();
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

        return new PromptTemplate(errors, tokens);
    }

    /**
     * Compiles the given |rawCondition| into a prompt condition. Six operators are available.
     */
    private static compileCondition(rawCondition: string): PromptCondition {
        const kOperators: { [k in PromptConditionOperator]: string } = {
            'eq': '==',
            'ne': '!=',
            'ge': '>=',
            'gt': '>',
            'le': '<=',
            'lt': '<',
        };

        // TODO: This leads to incorrect results when the condition includes a literal with |symbol|
        // A better parsing mechanism should be implemented to avoid this from happening.
        for (const [ operator, symbol ] of Object.entries(kOperators)) {
            if (!rawCondition.includes(symbol))
                continue;

            const [ lhs, rhs ] = rawCondition.split(symbol, /* limit= */ 2);
            return {
                operator: operator as PromptConditionOperator,
                lhs: this.compileConditionPart(lhs),
                rhs: this.compileConditionPart(rhs),
            };
        }

        let operator: PromptConditionOperator = 'eq';
        if (rawCondition.startsWith('!')) {
            rawCondition = rawCondition.substring(1);
            operator = 'ne';
        }

        return {
            operator,
            lhs: this.compileConditionPart(rawCondition),
            rhs: { type: 'boolean', value: true },
        };
    }

    /**
     * Compiles the given |rawConditionPart| to a typed prompt condition part.
     */
    private static compileConditionPart(rawConditionPart: string): PromptConditionPart {
        const trimmedRawConditionPart = rawConditionPart.trim();
        if (kBooleanFalsyRegexp.test(trimmedRawConditionPart))
            return { type: 'boolean', value: false };
        if (kBooleanTruthyRegexp.test(trimmedRawConditionPart))
            return { type: 'boolean', value: true };

        if (kNumberRegexp.test(trimmedRawConditionPart))
            return { type: 'number', value: parseFloat(trimmedRawConditionPart) };

        const stringLiteralMatch = trimmedRawConditionPart.match(kStringRegexp);
        if (stringLiteralMatch) {
            return {
                type: 'string',
                value: /* double quotes= */ stringLiteralMatch[1]
                    ?? /* single quotes= */ stringLiteralMatch[3]
            };
        }

        return {
            type: 'parameter',
            value: trimmedRawConditionPart,
        }
    }

    /**
     * Compiles the given |rawDirective| into a prompt token. Various sorts of directives are
     * supported, where unknown ones will fall into a canonical "unknownDirective" directive.
     */
    private static compileDirective(rawDirective: string): PromptDirective {
        const trimmedRawDirective = rawDirective.trim();

        if (trimmedRawDirective.startsWith('if')) {
            const rawCondition = trimmedRawDirective.substring(2).trim();
            return {
                directive: 'conditionStart',
                condition: this.compileCondition(rawCondition),
            };
        }

        if (trimmedRawDirective.startsWith('else'))
            return { directive: 'conditionElse' };

        if (trimmedRawDirective.startsWith('/if'))
            return { directive: 'conditionEnd' };

        return { directive: 'unknown', text: trimmedRawDirective };
    }

    // ---------------------------------------------------------------------------------------------

    readonly #errors: string[];
    readonly #parameters: string[]
    readonly #tokens: PromptTokens;

    private constructor(errors: string[], tokens: PromptTokens) {
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
     * Returns whether this template represents a prompt that can be evaluated.
     */
    get ok() { return !this.#errors.length; }

    /**
     * Returns the errors that occurred during compilation. Chronologically sorted.
     */
    get errors() { return this.#errors; }

    /**
     * Returns the substitution parameters that evaluation is expecting. Alphabetically sorted.
     */
    get parameters() { return [ ...this.#parameters ]; }

    get tokens() { return this.#tokens; }

    /**
     * Evaluates the compiled prompt, and returns the result as a string. The |args| can be passed
     * to substitute placeholders made available in the prompt.
     */
    evaluate(args?: NestedPromptParameter): string {
        const conditionStack: boolean[] = [ /* empty */ ];

        const result: string[] = [ /* none yet */ ];
        for (const token of this.#tokens) {
            const inFalseBranch = conditionStack.some(state => !state);
            if (inFalseBranch && (typeof token !== 'object' || !('directive' in token)))
                continue;  // ignore literals and parameters in non-truthy branches

            if (typeof token === 'string') {
                result.push(token);
                continue;
            }

            if ('parameter' in token) {
                const parameterValue = this.evaluteResolveParameter(token.parameter, args);

                result.push(`${parameterValue ?? kParameterUndefined}`);
                continue;
            }

            switch (token.directive) {
                case 'conditionStart': {
                    const lhs = this.evaluateResolveConditionPart(token.condition, 'lhs', args);
                    const rhs = this.evaluateResolveConditionPart(token.condition, 'rhs', args);
                    const result = this.evaluateCondition(token.condition.operator, lhs, rhs);

                    conditionStack.push(result);
                    break;
                }

                case 'conditionElse':
                    conditionStack.push(!conditionStack.pop());
                    break;

                case 'conditionEnd':
                    conditionStack.pop();
                    break;

                case 'unknown':
                    throw new Error('Reached unreachable code');
            }
        }

        return result.join('');
    }

    /**
     * Evaluates the condition between |lhs| and |rhs| based on the given |operator|.
     */
    private evaluateCondition(
        operator: PromptConditionOperator, lhs: PromptParameter, rhs: PromptParameter)
    {
        if (typeof lhs !== typeof rhs) {
            switch (typeof rhs) {
                case 'boolean':
                    lhs = !!lhs;
                    break;

                case 'number':
                    lhs = parseInt(`${lhs}`, /* radix= */ 10);
                    if (Number.isNaN(lhs))
                        return false;

                    break;

                case 'string':
                    lhs = `${lhs}`;
                    break;
            }
        }

        switch (operator) {
            case 'eq':
                return lhs === rhs;
            case 'ne':
                return lhs !== rhs;
            case 'ge':
                return lhs >= rhs;
            case 'gt':
                return lhs > rhs;
            case 'le':
                return lhs <= rhs;
            case 'lt':
                return lhs < rhs;
        }
    }

    /**
     * Evaluates the |side| from the given |condition|, which could either be a literal, or be a
     * reference to a parameter that has to be resolved.
     */
    private evaluateResolveConditionPart(
        condition: PromptCondition, side: 'lhs' | 'rhs', args?: NestedPromptParameter)
    {
        switch (condition[side].type) {
            case 'boolean':
            case 'number':
            case 'string':
                return condition[side].value;

            case 'parameter':
                return this.evaluteResolveParameter(condition[side].value, args) ?? false;
        }
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
