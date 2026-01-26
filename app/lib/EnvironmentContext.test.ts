// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { nanoid } from 'nanoid';

import { Temporal } from '@lib/Temporal';
import { determineAvailabilityStatus, generateInviteKey } from './EnvironmentContext';

describe('EnvironmentContext', () => {

    it('should be able to correctly determine availability statuses', () => {
        const currentTime = Temporal.Now.zonedDateTimeISO('utc');

        const eventEndTimeInThePast = currentTime.subtract({ hours: 1 });
        const eventEndTimeInTheFuture = currentTime.add({ hours: 1 });

        const startInTheFuture = currentTime.add({ days: 1 });
        const startInThePast = currentTime.subtract({ days: 2 });
        const startUndefined = undefined;

        const endInTheFuture = currentTime.add({ days: 2 });
        const endInThePast = currentTime.subtract({ days: 1 });
        const endUndefined = undefined;

        const kAvailabilityWindowPermutations = [
            [ startUndefined,   endUndefined,   eventEndTimeInThePast,   'past' ],    // 0
            [ startUndefined,   endUndefined,   eventEndTimeInTheFuture, 'future' ],  // 1
            [ startUndefined,   endInThePast,   eventEndTimeInThePast,   'past' ],    // 2
            [ startUndefined,   endInThePast,   eventEndTimeInTheFuture, 'past' ],    // 3
            [ startUndefined,   endInTheFuture, eventEndTimeInThePast,   'active' ],  // 4
            [ startUndefined,   endInTheFuture, eventEndTimeInTheFuture, 'active' ],  // 5

            [ startInThePast,   endUndefined,   eventEndTimeInThePast,   'past' ],    // 6
            [ startInThePast,   endUndefined,   eventEndTimeInTheFuture, 'active' ],  // 7
            [ startInThePast,   endInThePast,   eventEndTimeInThePast,   'past' ],    // 8
            [ startInThePast,   endInThePast,   eventEndTimeInTheFuture, 'past' ],    // 9
            [ startInThePast,   endInTheFuture, eventEndTimeInThePast,   'active' ],  // 10
            [ startInThePast,   endInTheFuture, eventEndTimeInTheFuture, 'active' ],  // 11

            [ startInTheFuture, endUndefined,   eventEndTimeInThePast,   'future' ],  // 12
            [ startInTheFuture, endUndefined,   eventEndTimeInTheFuture, 'future' ],  // 13
            [ startInTheFuture, endInThePast,   eventEndTimeInThePast,   'past' ],    // 14
            [ startInTheFuture, endInThePast,   eventEndTimeInTheFuture, 'past' ],    // 15
            [ startInTheFuture, endInTheFuture, eventEndTimeInThePast,   'future' ],  // 16
            [ startInTheFuture, endInTheFuture, eventEndTimeInTheFuture, 'future' ],  // 17
        ] as const;

        for (let testIndex = 0; testIndex < kAvailabilityWindowPermutations.length; ++testIndex) {
            const [ start, end, eventTime, expected ] = kAvailabilityWindowPermutations[testIndex];

            expect(determineAvailabilityStatus(currentTime, eventTime, {
                start,
                end,
                override: false,
            }), `permutation test (${testIndex})`).toBe(expected);
        }

        // Override
        {
            expect(determineAvailabilityStatus(currentTime, eventEndTimeInThePast, {
                start: startInThePast,
                end: endInThePast,
                override: true,  // <-- past becomes override
            })).toBe('override');

            expect(determineAvailabilityStatus(currentTime, eventEndTimeInThePast, {
                start: startUndefined,
                end: endUndefined,
                override: true,  // <-- future becomes override
            })).toBe('override');
        }
    });

    it('is able to generate unique invite keys', () => {
        const kEnabled = false;
        const kIterations = 100;

        const benchmarkStart = process.hrtime.bigint();

        // Confirm stability of the generated invite keys:
        for (let iteration = 0; iteration < kIterations; ++iteration) {
            const [ event, key ] = [ nanoid(8), nanoid(8) ];
            expect(generateInviteKey(event, key)).toEqual(generateInviteKey(event, key));
        }

        // Confirm that keys with different input values generate different results:
        for (let iteration = 0; iteration < kIterations; ++iteration) {
            const [ event, key ] = [ nanoid(8), nanoid(8) ];
            expect(generateInviteKey('fauxEvent', key)).not.toEqual(generateInviteKey(event, key));
            expect(generateInviteKey(event, 'fauxKey')).not.toEqual(generateInviteKey(event, key));
            expect(generateInviteKey(event, key)).not.toEqual(generateInviteKey(key, event));
        }

        const iterations = kIterations * 8;

        const benchmarkEnd = process.hrtime.bigint();
        const benchmarkTime = benchmarkEnd - benchmarkStart;
        const benchmarkTimeMs = Number(benchmarkTime / 10_000n);

        if (kEnabled) {
            console.log('generateInviteKey benchmark:');
            console.log('-- Iterations: ', iterations);
            console.log('-- Time taken (total):', benchmarkTimeMs / 100, 'ms');
            console.log('-- Time taken (call):', benchmarkTimeMs / iterations / 100, 'ms');

            expect(false).toBeTruthy();  // force a fail to see benchmark output
        }
    });
});
