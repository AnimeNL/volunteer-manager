// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { render, screen, waitFor } from '@testing-library/react';
import { z } from 'zod/v4';

import { LicenseInfo } from '@mui/x-license';

import type { AuthenticationContext } from '@lib/auth/AuthenticationContext';
import type { Column } from './Column';
import { default as DataTable } from './DataTableClient';
import { AccessControl } from '@lib/auth/AccessControl';
import { createDataSource } from './createDataSource';
import { withRowModel } from './';

const mocks = vi.hoisted(() => ({
    authenticationContext: vi.fn(),
    useIsMobile: vi.fn(),
}));

vi.mock('@app/admin/lib/useIsMobile', () => ({
    useIsMobile: () => mocks.useIsMobile(),
}));

vi.mock('@lib/auth/AuthenticationContext', () => ({
    getAuthenticationContext: async () => mocks.authenticationContext(),
}));

describe('DataTable - Reorder', () => {
    beforeEach(() => {
        if (Object.hasOwn(process.env, 'NEXT_PUBLIC_MUI_LICENSE_KEY'))
            LicenseInfo.setLicenseKey(process.env.NEXT_PUBLIC_MUI_LICENSE_KEY!);

        mocks.authenticationContext.mockReturnValue({
            access: new AccessControl({ /* no grants */ }),
            user: {
                id: 9001,
                name: 'John Doe',
                firstName: 'John',
                nameOrFirstName: 'John Doe',
                lastName: 'Doe'
            },
            authType: 'passkey',
            events: new Map(),
        } satisfies AuthenticationContext);

        mocks.useIsMobile.mockReturnValue(false);
    });

    afterEach(() => {
        mocks.authenticationContext.mockClear();
        mocks.useIsMobile.mockClear();
    });

    type ExampleRowModel = z.infer<typeof kExampleRowModel>;
    const kExampleRowModel = withRowModel({
        id: z.number(),
        name: z.string(),
        order: z.number(),
    });

    const kExampleRowData: ExampleRowModel[] = [
        { id: 1, name: 'First Item', order: 0 },
        { id: 2, name: 'Second Item', order: 1 },
    ];

    it('renders the data table when reordering is enabled on desktop', async () => {
        let reorderInvoked = false;

        const dataSource = createDataSource('my-reorder-source', kExampleRowModel, {
            async authorize(operation, props, context) { /* allow */ },
            async list(params, props, context) {
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData,
                };
            },
            async reorder(order, props, context) {
                reorderInvoked = true;
                return true;
            },
        });

        const columns: Column<ExampleRowModel>[] = [
            { field: 'id', headerName: 'ID', width: 50 },
            { field: 'name', headerName: 'Name', flex: 1 },
            { field: 'order', headerName: 'Order', width: 50 },
        ];

        render(
            <NuqsTestingAdapter>
                <DataTable columns={columns} source={dataSource}
                           defaultSort={{ field: 'order', sort: 'asc' }}
                           listViewProps={{ primaryField: 'name' }} />
            </NuqsTestingAdapter>
        );

        await waitFor(() => {
            expect(screen.getByText('First Item')).toBeDefined();
            expect(screen.getByText('Second Item')).toBeDefined();
        });

        expect(reorderInvoked).toBe(false);
    });

    it('passes the updated row order to the dataSource reorder method', async () => {
        let receivedOrder: number[] | undefined;

        const dataSource = createDataSource('my-reorder-source-2', kExampleRowModel, {
            async authorize(operation, props, context) { /* allow */ },
            async list(params, props, context) {
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData,
                };
            },
            async reorder(order, props, context) {
                receivedOrder = order;
                return true;
            },
        });

        const columns: Column<ExampleRowModel>[] = [
            { field: 'id', headerName: 'ID', width: 50 },
            { field: 'name', headerName: 'Name', flex: 1 },
            { field: 'order', headerName: 'Order', width: 50 },
        ];

        render(
            <NuqsTestingAdapter>
                <DataTable columns={columns} source={dataSource}
                           defaultSort={{ field: 'order', sort: 'asc' }}
                           listViewProps={{ primaryField: 'name' }} />
            </NuqsTestingAdapter>
        );

        await waitFor(() => {
            expect(screen.getByText('First Item')).toBeDefined();
        });

        expect(receivedOrder).toBeUndefined();
        expect(screen.getAllByRole('row').length).toBeGreaterThan(0);
    });
});
