// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type Settings, readSetting } from '@lib/Settings';
import { type PromptParameters, PromptTemplate } from './PromptTemplate';

/**
 * Utility type to extract the |Settings| values that map to string values, and ignore the rest.
 */
type StringSettings<T> = { [k in keyof T]: T[k] extends string ? k : never }[keyof T];

/**
 * Type defining the metadata associated with a particular prompt type.
 */
type Metadata = {
    /**
     * Unique ID through which this prompt can be identified.
     */
    id: string;

    /**
     * Label that describes that this prompt is about.
     */
    label: string;

    /**
     * Description of the prompt, in a slightly more elaborate manner. (2-3 sentences.)
     */
    description: string;

    /**
     * The setting in which this prompt will be stored.
     */
    setting: StringSettings<Settings>;
};

/**
 * This is the base class that implements the core functionality of dealing with prompts, i.e.
 * reading configured prompt text, putting it through template compilation and executing it with the
 * right set of parameters expected by the prompt. It's not meant to be instantiated directly.
 */
export abstract class Prompt<T extends PromptParameters> {
    #templateText: string | undefined;
    #template: PromptTemplate | undefined;

    constructor(templateText?: string) {
        this.#templateText = templateText;
        this.#template = undefined;
    }

    /**
     * Returns the metadata information for this prompt.
     */
    abstract get metadata(): Metadata;

    /**
     * Returns the parameters accepted by this prompt that should be used for example purposes.
     */
    abstract get exampleParameters(): T;

    /**
     * Returns the template for this prompt. Will lazily obtain the prompt's text from settings if
     * this is the first access, which may incur a database operation.
     */
    get template(): Promise<PromptTemplate> {
        return new Promise(async (resolve) => {
            if (this.#template === undefined) {
                this.#templateText ??= await readSetting(this.metadata.setting) ?? '';
                this.#template = PromptTemplate.compile(this.#templateText);
            }

            return resolve(this.#template);
        });
    }

    /**
     * Evaluates the prompt with the given |params|. The first invocation of this method will result
     * in a setting being read in order to obtain the prompt's text.
     */
    async evaluate(params: T): Promise<string> {
        const template = await this.template;
        return template.evaluate(params);
    }

    /**
     * Computes the valid parameter paths based on the example parameters that are made available to
     * the prompt instance. Will return the result as a set. Used by the validator, as well as by
     * the user interface to identify the available parameters.
     */
    get parameters(): Set<string> {
        const paths = new Set<string>();

        const seen: WeakSet<object> = new WeakSet([ this.exampleParameters ]);
        const stack: [{ node: object, prefix: string }] = [
            {
                node: this.exampleParameters,
                prefix: '',
            }
        ];

        while (stack.length > 0) {
            const { node, prefix } = stack.pop()!;

            const keys = Object.keys(node).reverse();
            for (const key of keys) {
                const value = node[key as keyof typeof node];
                const path = prefix ? `${prefix}.${key}` : key;

                if (typeof value === 'object' && value && !seen.has(value))
                    stack.push({ node: value, prefix: path });
                else
                    paths.add(path);
            }
        }

        return paths;
    }
}
