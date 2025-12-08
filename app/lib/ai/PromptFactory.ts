// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Prompt } from './Prompt';

import * as prompts from './prompts';

/**
 * Type to define the prompts that are available throughout the Volunteer Manager.
 */
type Prompts = InstanceType<typeof prompts[keyof typeof prompts]>;

/**
 * Type to define the constructor types for one or more prompts.
 */
type Constructor<T> = T extends Prompt<any> ? new () => T : never;

/**
 * Unique constructors that exist within the Volunteer Manager.
 */
type PromptConstructor = Constructor<Prompts>;

/**
 * Unique IDs assigned to the prompts that exist within the Volunteer Manager.
 */
type PromptId = Prompts['metadata']['id'];

/**
 * Helper class that is able to quickly create a prompt by its ID, and return the constructor with
 * which it can be instantiated. This uses a local cache to make this an O(1) operation.
 */
export class PromptFactory {
    /**
     * Static cache of the prompt constructors that are known in this instance.
     */
    static #constructorCache: Map<PromptId, PromptConstructor> | undefined;

    /**
     * Instantiates a new Prompt instance based on the given |id|. When the |id| is a known, static
     * prompt ID then a typed instance will be returned, otherwise it will be an untyped Prompt
     * instance, or undefined when no prompt could be identified.
     */
    static createById<K extends PromptId>(id: K): Extract<Prompts, { metadata: { id: K } }>;
    static createById(id: string): Prompt<any> | undefined;
    static createById(id: string): Prompt<any> | undefined {
        if (PromptFactory.#constructorCache === undefined)
            PromptFactory.buildConstructorCache();

        const constructor = PromptFactory.#constructorCache?.get(id as PromptId);
        return constructor ? new constructor()
                           : undefined;
    }

    /**
     * Builds the constructor cache to use with the PromptFactory interface. This will initialise
     * each prompt instance once to obtain its ID, and then dispose of the instances.
     */
    private static buildConstructorCache(): void {
        PromptFactory.#constructorCache = new Map(Object.values(prompts).map(constructor => ([
            (new constructor()).metadata.id,
            constructor,
        ])));
    }
}
