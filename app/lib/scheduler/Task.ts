// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { TaskContext } from './TaskContext';
import type { TaskResult } from '../database/Types';
export type { TaskResult };

/**
 * Abstract class describing a task that can be owned by the `TaskRegistry` and executed using the
 * `TaskRunner`. It implements basic functionality minimising the per-task implementation cost.
 */
abstract class TaskBase {
    #context: TaskContext;
    #acceptsParams: boolean;

    protected constructor(context: TaskContext, acceptsParams: boolean) {
        this.#context = context;
        this.#acceptsParams = acceptsParams;
    }

    /**
     * Gives access to the full task context. Must only be used for testing purposes.
     */
    get contextForTesting() { return this.#context; }

    /**
     * Returns the logger that can be used for this task execution.
     */
    get log() { return this.#context.log; }

    /**
     * Returns whether `this` represents a simple task, i.e. one without parameters.
     */
    isSimpleTask(): this is Task { return !this.#acceptsParams; }

    /**
     * Returns whether `this` represents a complex task, i.e. one that accepts parameters.
     */
    isComplexTask(): this is TaskWithParams<unknown> { return !!this.#acceptsParams; }

    /**
     * Updates the interval to `intervalMs` in case this is a repeating task. `undefined` can be
     * passed to stop repeating the task altogether. Only has an effect when the task already is set
     * as a repeating task.
     */
    setIntervalForRepeatingTask(intervalMs?: number) {
        this.#context.setIntervalForRepeatingTask(intervalMs);
    }
}

/**
 * Abstract class to extend when the task is not expecting to take any parameters.
 */
export abstract class Task extends TaskBase {
    constructor(context: TaskContext) {
        super(context, /* acceptsParams= */ false);
    }

    /**
     * Executes the task. No parameters are accepted.
     */
    abstract execute(): Promise<boolean>;
}

/**
 * Abstract class to extend when the task is expecting to take parameters. The parameters will be
 * validated prior to being passed to the `execute()` method.
 */
export abstract class TaskWithParams<ParamsType> extends TaskBase {
    constructor(context: TaskContext) {
        super(context, /* acceptsParams= */ true);
    }

    /**
     * Validates that the given `params` validate in accordance to the expected syntax.
     */
    abstract validate(params: unknown): ParamsType | never;

    /**
     * Executes the task with the given `params`.
     */
    abstract execute(params: ParamsType): Promise<boolean>;
}
