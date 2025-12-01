// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { nanoid } from 'nanoid';

import { Temporal } from '@lib/Temporal';
import { determineAvailabilityStatus, generateInviteKey } from './EnvironmentContext';

describe('EnvironmentContext', () => {

    it('should be able to correctly determine availability statuses', () => {
        const currentTime = Temporal.Now.zonedDateTimeISO('utc');

        const startInTheFuture = currentTime.add({ days: 1 });
        const startInThePast = currentTime.subtract({ days: 2 });
        const startUndefined = undefined;

        const endInTheFuture = currentTime.add({ days: 2 });
        const endInThePast = currentTime.subtract({ days: 1 });
        const endUndefined = undefined;

        // Past
        {
            expect(determineAvailabilityStatus(currentTime, {
                start: startInThePast,
                end: endInThePast,
                override: false,
            })).toBe('past');
        }

        // Active
        {
            expect(determineAvailabilityStatus(currentTime, {
                start: startInThePast,
                end: endInTheFuture,
                override: false,
            })).toBe('active');

            expect(determineAvailabilityStatus(currentTime, {
                start: startInThePast,
                end: endUndefined,
                override: false,
            })).toBe('active');
        }

        // Future
        {
            expect(determineAvailabilityStatus(currentTime, {
                start: startInTheFuture,
                end: endUndefined,
                override: false,
            })).toBe('future');

            expect(determineAvailabilityStatus(currentTime, {
                start: startUndefined,
                end: endUndefined,
                override: false,
            })).toBe('future');

            expect(determineAvailabilityStatus(currentTime, {
                start: startUndefined,
                end: endInTheFuture,
                override: false,
            })).toBe('future');
        }

        // Override
        {
            expect(determineAvailabilityStatus(currentTime, {
                start: startInThePast,
                end: endInThePast,
                override: true,  // <-- past becomes override
            })).toBe('override');

            expect(determineAvailabilityStatus(currentTime, {
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
