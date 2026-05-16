// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { render, screen, waitFor } from '@testing-library/react';
import { z } from 'zod';

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

describe('DataTable', () => {
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
        role: z.string(),
    });

    const kExampleRowData: ExampleRowModel[] = [
        { id:  1, name: 'Amia Bell', role: 'Manager' },
        { id:  2, name: 'Chi Diara', role: 'Engineer' },
        { id:  3, name: 'Elias Finch', role: 'Sales' },
        { id:  4, name: 'Gaya Harper', role: 'Admin' },
        { id:  5, name: 'Ivan Jones', role: 'Production' },
        { id:  6, name: 'Kaelo Lee', role: 'Hardware' },
        { id:  7, name: 'Maya Nguyen', role: 'Controller' },
        { id:  8, name: 'Omar Patel', role: 'Auditor' },
        { id:  9, name: 'Quinn Reyes', role: 'Legal' },
        { id: 10, name: 'Sachi Tanaka', role: 'Design' },
        { id: 11, name: 'Uma Varma', role: 'Associate' },
        { id: 12, name: 'Wren Xavier', role: 'Executive' },
        { id: 13, name: 'Yara Zale', role: 'Marketing' },
    ];

    it('is able to list rows using the data source in regular view', async () => {
        let dataSourceListInvoked = false;

        const dataSource = createDataSource('test/list-rows-regular', kExampleRowModel, {
            async authorize(operation, props, context) { /* no-op */ },
            async list(context, params) {
                dataSourceListInvoked = true;
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData.slice(
                        context.page.offset, context.page.offset + context.page.limit),
                };
            },
        });

        const columns: Column<ExampleRowModel>[] = [
            {
                field: 'name',
                headerName: 'NameHeader',
            }
        ];

        render(<DataTable source={dataSource} columns={columns}
                          defaultSort={{ field: 'name', sort: 'asc' }}
                          listViewProps={{ primaryField: 'name' }} />);

        // The table's headers are expected to be available immediately, although listing the data
        // from the data source is an asynchronous operation that has to be waited for.
        expect(screen.getByText('NameHeader')).toBeDefined();
        expect(() => screen.getByText('Amia Bell')).toThrow();

        // The data will be made available asynchronously. Wait for it.
        await waitFor(() => {
            expect(screen.getByText('Quinn Reyes')).toBeDefined();
        });

        expect(dataSourceListInvoked).toBeTruthy();
    });

    it('is able to list rows using the data source in responsive view', async () => {
        let dataSourceListInvoked = false;

        const dataSource = createDataSource('test/list-rows-responsive', kExampleRowModel, {
            async authorize(operation, props, context) { /* no-op */ },
            async list(context, params) {
                dataSourceListInvoked = true;
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData.slice(
                        context.page.offset, context.page.offset + context.page.limit),
                };
            },
        });

        const columns: Column<ExampleRowModel>[] = [
            {
                field: 'name',
                headerName: 'NameHeader',
            }
        ];

        mocks.useIsMobile.mockReturnValue(true);

        render(<DataTable source={dataSource} columns={columns}
                          defaultSort={{ field: 'name', sort: 'asc' }}
                          listViewProps={{ primaryField: 'role' }} />);

        // The table's columns are not shown in mobile view as we display a list of items instead,
        // whereas the data will be shown, but will be streamed in asynchronously.
        expect(() => screen.getByText('NameHeader')).toThrow();
        expect(() => screen.getByText('Maya Nguyen')).toThrow();
        expect(() => screen.getByText('Controller')).toThrow();

        // The data will be made available asynchronously. Wait for it. Even though `columns` wants
        // to display the name, this is overridden by `listViewProps` for responsive view.
        await waitFor(() => {
            expect(screen.getByText('Controller')).toBeDefined();
        });

        expect(dataSourceListInvoked).toBeTruthy();
    });
});
