// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod';

import { type Column, type ExtractRowModel, DataTable, createDataSource, withRowModel } from '@app/admin/components/DataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import db, { tEvents } from '@lib/database';

/**
 * Data source for the example <DataTable> component. Provides the data.
 */
const dataSource = createDataSource('system/debug/data-table', withRowModel({
    id: z.number(),
    name: z.string(),
    location: z.string().optional(),
}), {
    async getRows(params) {
        const results = await db.selectFrom(tEvents)
            .select({
                id: tEvents.eventId,
                name: tEvents.eventName,
                location: tEvents.eventLocation,
            })
            .executeSelectPage();

        return {
            rows: results.data,
            rowCount: results.count,
        };
    },
});

type RowModel = ExtractRowModel<typeof dataSource>;

/**
 * Page that displays a <DataTable> component.
 */
export default function DataTablePage() {
    const columns: Column[] = [
        {
            field: 'name',
        },
        {
            field: 'location',
        }
    ];

    return (
        <Section title="DataTable">
            <SectionIntroduction>
                This is an example page for the new generic {'<'}DataTable{'>'} component.
            </SectionIntroduction>
            <DataTable columns={columns} source={dataSource} />
        </Section>
    );
}
