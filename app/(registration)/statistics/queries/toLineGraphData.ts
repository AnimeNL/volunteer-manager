// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { LineGraphData } from '../components/LineGraph';

/**
 * Result from a database query that should be converted to a `LineGraphData` type.
 */
type DatabaseResult = {
    event: {
        slug: string;
    };
    series: {
        id: string;
        color: string;
        label: string;
    };
    value: number;
};

/**
 * Converts the given `input` to a structure that is compatible with the `LineGraphData` type. The
 * events included in the `input` are expected to be included in ascending order.
 */
export function toLineGraphData(input: DatabaseResult[]): LineGraphData {
    const dataset = new Map<string, Record<string, string | number | null>>();
    const series = new Map<string, LineGraphData['series'][number]>();

    const xAxis = new Map<string, NonNullable<LineGraphData['xAxis']>[number]>();
    const xAxisIds: string[] = [ /* empty */ ];

    for (const entry of input) {
        if (!dataset.has(entry.event.slug)) {
            dataset.set(entry.event.slug, {
                event: entry.event.slug,
            });
        }

        dataset.get(entry.event.slug)![entry.series.id] = entry.value;

        if (!series.has(entry.series.id)) {
            series.set(entry.series.id, {
                dataKey: entry.series.id,

                color: entry.series.color,
                label: entry.series.label,
            });
        }

        if (!xAxis.has(entry.event.slug)) {
            xAxisIds.push(entry.event.slug);
            xAxis.set(entry.event.slug, {
                id: entry.event.slug,
                dataKey: 'event',
                scaleType: 'band',
            });
        }
    }

    return {
        dataset: [ ...dataset.values() ],
        series: [ ...series.values() ],
        xAxis: xAxisIds.map(key => xAxis.get(key)!),
    };
}
