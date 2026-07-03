// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden } from 'next/navigation';
import { z } from 'zod';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { DataTable, createDataSource, withContext, withRowModel, kEventTransformer }
    from '@app/admin/components/DataTable';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tEvents } from '@lib/database';

/**
 * Data source for the example <DataTable> component. Provides the data.
 */
const dataSource = createDataSource('system/debug/data-table', withContext({
    event: kEventTransformer,
}), withRowModel({
    id: z.number(),
    name: z.string(),
    location: z.string().optional(),
}), {
    async authorize(operation, props, context) {
        if (!props.access.can('admin'))
            forbidden();
    },

    async delete(params, props, context) {
        console.log(params);
        return true;
    },

    async list(params, props, context) {
        const results = await db.selectFrom(tEvents)
            .select({
                id: tEvents.eventId,
                name: tEvents.eventName,
                location: tEvents.eventLocation,
            })
            .orderBy(params.sort.field as any, params.sort.direction)
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
export default async function DataTablePage() {
    const authenticationContext = await requireAuthenticationContext({ check: 'admin' });

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
            <DataTable columns={columns} context={{ event: '2026' }}
                       source={dataSource.authorize(authenticationContext, { event: '2026' })}
                       defaultSort={{ field: 'name', sort: 'desc' }} disableSearch listViewProps={{
                          primaryField: 'name',
                       }} />
        </Section>
    );
}
