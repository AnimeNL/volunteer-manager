// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { computePercentile, summarizeRouteVitals } from './computeVitalsSummary';

describe('computeVitalsSummary', () => {
    it('computes p75 percentiles accurately', () => {
        expect(computePercentile([], 75)).toBeNull();
        expect(computePercentile([ 100 ], 75)).toEqual(100);
        expect(computePercentile([ 400, 100, 300, 200 ], 75)).toEqual(300);
        expect(computePercentile([ 10, 20, 30, 40, 50, 60, 70, 80 ], 75)).toEqual(60);
    });

    it('summarizes per-route p75 metrics sorted by slowest LCP first', () => {
        const result = summarizeRouteVitals([
            { route: '/example/fast', metric: 'LCP', value: 450 },
            { route: '/example/fast', metric: 'FCP', value: 200 },
            { route: '/example/slow', metric: 'LCP', value: 1800 },
            { route: '/example/slow', metric: 'LCP', value: 2400 },
            { route: '/example/slow', metric: 'TTFB', value: 320 },
            { route: '/example/slow', metric: 'INP', value: 90 },
            { route: '/example/slow', metric: 'CLS', value: 0.08 },
        ]);

        expect(result).toEqual([
            {
                route: '/example/slow',
                samples: 5,
                ttfbP75: 320,
                fcpP75: null,
                lcpP75: 2400,
                inpP75: 90,
                clsP75: 0.08,
            },
            {
                route: '/example/fast',
                samples: 2,
                ttfbP75: null,
                fcpP75: 200,
                lcpP75: 450,
                inpP75: null,
                clsP75: null,
            },
        ]);
    });
});
