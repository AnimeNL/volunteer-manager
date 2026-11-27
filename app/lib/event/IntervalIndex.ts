// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { TimeInterval } from './Types';

/**
 * Node in a static centered interval tree over half-open `[startMs, endMs)` intervals.
 */
interface IntervalTreeNode<T extends TimeInterval> {
    readonly center: number;
    readonly byStart: readonly T[];
    readonly byEnd: readonly T[];
    readonly left?: IntervalTreeNode<T>;
    readonly right?: IntervalTreeNode<T>;
}

/**
 * Compares two intervals by `startMs` ascending, then `endMs` ascending.
 */
function compareByStart(lhs: TimeInterval, rhs: TimeInterval): number {
    return lhs.startMs - rhs.startMs || lhs.endMs - rhs.endMs;
}

/**
 * Compares two intervals by `endMs` descending, then `startMs` ascending.
 */
function compareByEndDescending(lhs: TimeInterval, rhs: TimeInterval): number {
    return rhs.endMs - lhs.endMs || lhs.startMs - rhs.startMs;
}

/**
 * Recursively constructs a static centered interval tree from valid non-empty intervals already
 * sorted by `startMs` ascending.
 */
function buildTree<T extends TimeInterval>(sortedItems: readonly T[]): IntervalTreeNode<T> | undefined {
    if (!sortedItems.length)
        return undefined;

    // Picking the median interval's `startMs` as the split point guarantees that at least that
    // interval satisfies `startMs <= center < endMs`, ensuring strict recursion termination.
    const center = sortedItems[Math.floor(sortedItems.length / 2)].startMs;

    const leftItems: T[] = [];
    const rightItems: T[] = [];
    const spanning: T[] = [];

    for (const item of sortedItems) {
        if (item.endMs <= center)
            leftItems.push(item);
        else if (item.startMs > center)
            rightItems.push(item);
        else
            spanning.push(item);
    }

    return {
        center,
        byStart: spanning,  // preserves ascending `startMs` order from `sortedItems`
        byEnd: [ ...spanning ].sort(compareByEndDescending),
        left: buildTree(leftItems),
        right: buildTree(rightItems),
    };
}

/**
 * Builds a deduplicated, ascending array of all `startMs` and `endMs` boundary timestamps.
 */
function buildBoundaries(items: readonly TimeInterval[]): readonly number[] {
    if (!items.length)
        return [];

    const raw: number[] = [];
    for (const item of items) {
        raw.push(item.startMs, item.endMs);
    }

    raw.sort((lhs, rhs) => lhs - rhs);

    const unique: number[] = [ raw[0] ];
    for (let index = 1; index < raw.length; ++index) {
        if (raw[index] !== raw[index - 1])
            unique.push(raw[index]);
    }

    return unique;
}

/**
 * Immutable time-interval index supporting O(log N + k) point-in-time (`at`) and range
 * (`overlapping`) lookups over half-open `[startMs, endMs)` intervals, plus O(log B) boundary
 * transition lookups (`nextTransitionAfter`).
 */
export class IntervalIndex<T extends TimeInterval> {
    readonly #all: readonly T[];
    readonly #boundaries: readonly number[];
    readonly #root?: IntervalTreeNode<T>;

    constructor(items: Iterable<T>) {
        const valid: T[] = [];
        for (const item of items) {
            if (item.endMs > item.startMs)
                valid.push(item);
        }

        valid.sort(compareByStart);

        this.#all = valid;
        this.#boundaries = buildBoundaries(valid);
        this.#root = buildTree(valid);
    }

    /**
     * All indexed intervals sorted by `startMs` ascending, then `endMs` ascending.
     */
    get all(): readonly T[] {
        return this.#all;
    }

    /**
     * Number of non-empty intervals stored in this index.
     */
    get size(): number {
        return this.#all.length;
    }

    /**
     * Returns all intervals active at `timeMs` (`startMs <= timeMs < endMs`), sorted by `startMs`
     * ascending then `endMs` ascending.
     */
    at(timeMs: number): T[] {
        const results: T[] = [];
        let node = this.#root;

        while (node) {
            if (timeMs < node.center) {
                for (const item of node.byStart) {
                    if (item.startMs > timeMs)
                        break;

                    results.push(item);
                }

                node = node.left;
            } else if (timeMs > node.center) {
                for (const item of node.byEnd) {
                    if (item.endMs <= timeMs)
                        break;

                    results.push(item);
                }

                node = node.right;
            } else {
                for (const item of node.byStart)
                    results.push(item);

                break;
            }
        }

        if (results.length > 1)
            results.sort(compareByStart);

        return results;
    }

    /**
     * Returns all intervals overlapping `[startMs, endMs)` (`item.startMs < endMs &&
     * item.endMs > startMs`), sorted by `startMs` ascending then `endMs` ascending.
     */
    overlapping(startMs: number, endMs: number): T[] {
        if (endMs <= startMs || !this.#root)
            return [];

        const results: T[] = [];
        const stack: IntervalTreeNode<T>[] = [ this.#root ];

        while (stack.length > 0) {
            const node = stack.pop()!;

            if (endMs <= node.center) {
                for (const item of node.byStart) {
                    if (item.startMs >= endMs)
                        break;

                    results.push(item);
                }

                if (node.left)
                    stack.push(node.left);
            } else if (startMs >= node.center) {
                for (const item of node.byEnd) {
                    if (item.endMs <= startMs)
                        break;

                    results.push(item);
                }

                if (node.right)
                    stack.push(node.right);
            } else {
                for (const item of node.byStart)
                    results.push(item);

                if (node.left)
                    stack.push(node.left);
                if (node.right)
                    stack.push(node.right);
            }
        }

        if (results.length > 1)
            results.sort(compareByStart);

        return results;
    }

    /**
     * Returns the earliest interval boundary strictly greater than `timeMs`, or `undefined` when
     * no further interval starts or ends after `timeMs`.
     */
    nextTransitionAfter(timeMs: number): number | undefined {
        const boundaries = this.#boundaries;
        let low = 0;
        let high = boundaries.length;

        while (low < high) {
            const mid = (low + high) >>> 1;
            if (boundaries[mid] <= timeMs)
                low = mid + 1;
            else
                high = mid;
        }

        return low < boundaries.length ? boundaries[low] : undefined;
    }
}
