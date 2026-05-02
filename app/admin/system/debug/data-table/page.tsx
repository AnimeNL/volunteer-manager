// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod';

import type { Column, ExtractContext, ExtractRowModel } from '@app/admin/components/DataTable';
import { DataTable, createDataSource, withContext, withRowModel } from '@app/admin/components/DataTable';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import db, { tEvents } from '@lib/database';

/**
 * Data source for the example <DataTable> component. Provides the data.
 */
const dataSource = createDataSource('system/debug/data-table', withContext({
    value: z.number(),
}), withRowModel({
    id: z.number(),
    name: z.string(),
    location: z.string().optional(),
}), {
    async getRows(params, props, context) {
        const results = await db.selectFrom(tEvents)
            .select({
                id: tEvents.eventId,
                name: tEvents.eventName,
                location: tEvents.eventLocation,
            })
            .orderBy(params.sortModel[0]?.field || 'name', params.sortModel[0]?.sort || 'asc')
            .executeSelectPage();

        return {
            rows: results.data,
            rowCount: results.count,
        };
    },
});

type Context = ExtractContext<typeof dataSource>;
type RowModel = ExtractRowModel<typeof dataSource>;

/**
 * Page that displays a <DataTable> component.
 */
export default function DataTablePage() {
    const columns: Column<RowModel>[] = [
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
            <DataTable columns={columns} source={dataSource} context={{ value: 42 }} />
        </Section>
    );
}
