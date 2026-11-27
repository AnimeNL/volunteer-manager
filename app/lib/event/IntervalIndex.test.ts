// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { TimeInterval } from './Types';
import { IntervalIndex } from './IntervalIndex';

interface LabeledInterval extends TimeInterval {
    id: string;
}

describe('IntervalIndex', () => {
    it('handles empty inputs and ignores degenerate intervals', () => {
        const index = new IntervalIndex<LabeledInterval>([
            { id: 'zero', startMs: 100, endMs: 100 },
            { id: 'inverted', startMs: 200, endMs: 150 },
        ]);

        expect(index.size).toBe(0);
        expect(index.all).toEqual([]);
        expect(index.at(100)).toEqual([]);
        expect(index.overlapping(0, 500)).toEqual([]);
        expect(index.nextTransitionAfter(0)).toBeUndefined();
    });

    it('enforces half-open [startMs, endMs) boundaries for back-to-back intervals', () => {
        const index = new IntervalIndex<LabeledInterval>([
            { id: 'first', startMs: 100, endMs: 200 },
            { id: 'second', startMs: 200, endMs: 300 },
        ]);

        expect(index.at(99)).toEqual([]);
        expect(index.at(100).map(item => item.id)).toEqual([ 'first' ]);
        expect(index.at(199).map(item => item.id)).toEqual([ 'first' ]);
        expect(index.at(200).map(item => item.id)).toEqual([ 'second' ]);
        expect(index.at(299).map(item => item.id)).toEqual([ 'second' ]);
        expect(index.at(300)).toEqual([]);
    });

    it('handles identical and long-spanning overlapping intervals', () => {
        const index = new IntervalIndex<LabeledInterval>([
            { id: 'weekend', startMs: 0, endMs: 1000 },
            { id: 'dup-a', startMs: 200, endMs: 400 },
            { id: 'dup-b', startMs: 200, endMs: 400 },
            { id: 'short', startMs: 250, endMs: 300 },
            { id: 'late', startMs: 600, endMs: 700 },
        ]);

        expect(index.at(250).map(item => item.id)).toEqual([
            'weekend', 'dup-a', 'dup-b', 'short',
        ]);
        expect(index.at(350).map(item => item.id)).toEqual([
            'weekend', 'dup-a', 'dup-b',
        ]);
        expect(index.at(650).map(item => item.id)).toEqual([
            'weekend', 'late',
        ]);
    });

    it('finds overlapping intervals accurately against a brute-force oracle', () => {
        const items: LabeledInterval[] = [];
        for (let i = 0; i < 60; ++i) {
            const startMs = (i * 37) % 400;
            const duration = 10 + ((i * 53) % 180);
            items.push({ id: `item-${i}`, startMs, endMs: startMs + duration });
        }

        const index = new IntervalIndex(items);

        // Verify point queries across the full range.
        for (let t = -10; t <= 600; t += 11) {
            const expected = items
                .filter(item => item.startMs <= t && t < item.endMs)
                .sort((lhs, rhs) => lhs.startMs - rhs.startMs || lhs.endMs - rhs.endMs)
                .map(item => item.id);

            expect(index.at(t).map(item => item.id)).toEqual(expected);
        }

        // Verify range queries across varied windows.
        const ranges: [ number, number ][] = [
            [ -50, 0 ],
            [ 0, 50 ],
            [ 100, 100 ],
            [ 100, 250 ],
            [ 350, 600 ],
            [ 0, 1000 ],
        ];

        for (const [ startMs, endMs ] of ranges) {
            const expected = endMs <= startMs ? [] : items
                .filter(item => item.startMs < endMs && item.endMs > startMs)
                .sort((lhs, rhs) => lhs.startMs - rhs.startMs || lhs.endMs - rhs.endMs)
                .map(item => item.id);

            expect(index.overlapping(startMs, endMs).map(item => item.id)).toEqual(expected);
        }
    });

    it('returns the next strict boundary transition timestamp', () => {
        const index = new IntervalIndex<LabeledInterval>([
            { id: 'a', startMs: 100, endMs: 300 },
            { id: 'b', startMs: 200, endMs: 300 },
            { id: 'c', startMs: 500, endMs: 600 },
        ]);

        expect(index.nextTransitionAfter(0)).toBe(100);
        expect(index.nextTransitionAfter(100)).toBe(200);
        expect(index.nextTransitionAfter(200)).toBe(300);
        expect(index.nextTransitionAfter(300)).toBe(500);
        expect(index.nextTransitionAfter(599)).toBe(600);
        expect(index.nextTransitionAfter(600)).toBeUndefined();
    });
});
