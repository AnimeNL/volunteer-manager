// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('DataTable - Pagination', () => {
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

    it.each([ true, false ])('is able to navigate through the results (isMobile=%s)', async p => {
        const dataSource = createDataSource(`test/navigate-rows-${p}`, kExampleRowModel, {
            async authorize(operation, props, context) { /* no-op */ },
            async list(params) {
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData.slice(
                        params.page.offset, params.page.offset + params.page.limit),
                };
            },
        }).authorize(mocks.authenticationContext());

        const columns: Column<ExampleRowModel>[] = [{ field: 'name' }];

        mocks.useIsMobile.mockReturnValue(p);

        render(
            <NuqsTestingAdapter>
                <DataTable source={dataSource} columns={columns} pageSize={10}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           listViewProps={{ primaryField: 'name' }} />
            </NuqsTestingAdapter>
        );

        // The data's first page will be made available asynchronously. Wait for it.
        await waitFor(() => {
            expect(screen.getByText('Quinn Reyes')).toBeDefined();
        });

        // The first ten rows are expected to be displayed, but not our target (ID 12):
        expect(screen.getByText('Sachi Tanaka')).toBeDefined();
        expect(() => screen.getByText('Wren Xavier')).toThrow();

        fireEvent.click(screen.getByTestId('navigate-next'));

        // The remaining rows are now displayed, which means the first ones have been hidden:
        await waitFor(() => {
            expect(() => screen.getByText('Sachi Tanaka')).toThrow();
            expect(screen.getByText('Wren Xavier')).toBeDefined();
        });

        fireEvent.click(screen.getByTestId('navigate-back'));

        // And we expect to be back to the first ten rows in the view:
        await waitFor(() => {
            expect(screen.getByText('Sachi Tanaka')).toBeDefined();
            expect(() => screen.getByText('Wren Xavier')).toThrow();
        });
    });

    it('respects the page query parameter from the URL', async () => {
        let requestedPage: { offset: number; limit: number } | undefined;

        const dataSource = createDataSource('test/page-query-param', kExampleRowModel, {
            async authorize() {},
            async list(params) {
                requestedPage = params.page;
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData.slice(
                        params.page.offset, params.page.offset + params.page.limit),
                };
            },
        }).authorize(mocks.authenticationContext());

        const columns: Column<ExampleRowModel>[] = [{ field: 'name' }];

        render(
            <NuqsTestingAdapter searchParams="?page=2">
                <DataTable source={dataSource} columns={columns} pageSize={10}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           listViewProps={{ primaryField: 'name' }} />
            </NuqsTestingAdapter>
        );

        await waitFor(() => {
            expect(requestedPage).toBeDefined();
        });

        expect(requestedPage!.offset).toBe(10);
        expect(requestedPage!.limit).toBe(10);
    });

    it('respects the pageSize query parameter from the URL', async () => {
        let requestedPage: { offset: number; limit: number } | undefined;

        const dataSource = createDataSource('test/pagesize-query-param', kExampleRowModel, {
            async authorize() {},
            async list(params) {
                requestedPage = params.page;
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData.slice(
                        params.page.offset, params.page.offset + params.page.limit),
                };
            },
        }).authorize(mocks.authenticationContext());

        const columns: Column<ExampleRowModel>[] = [{ field: 'name' }];

        render(
            <NuqsTestingAdapter searchParams="?pageSize=25">
                <DataTable source={dataSource} columns={columns}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           listViewProps={{ primaryField: 'name' }} />
            </NuqsTestingAdapter>
        );

        await waitFor(() => {
            expect(requestedPage).toBeDefined();
        });

        expect(requestedPage!.offset).toBe(0);
        expect(requestedPage!.limit).toBe(25);
    });

    it('does not respect URL query parameters when disableQueryParams is set', async () => {
        let requestedPage: { offset: number; limit: number } | undefined;

        const dataSource = createDataSource('test/disable-query-params', kExampleRowModel, {
            async authorize() {},
            async list(params) {
                requestedPage = params.page;
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData.slice(
                        params.page.offset, params.page.offset + params.page.limit),
                };
            },
        }).authorize(mocks.authenticationContext());

        const columns: Column<ExampleRowModel>[] = [{ field: 'name' }];

        render(
            <NuqsTestingAdapter searchParams="?page=1&pageSize=25">
                <DataTable source={dataSource} columns={columns} disableQueryParams
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           listViewProps={{ primaryField: 'name' }} />
            </NuqsTestingAdapter>
        );

        await waitFor(() => {
            expect(requestedPage).toBeDefined();
        });

        expect(requestedPage!.offset).toBe(0);
        expect(requestedPage!.limit).toBe(50);
    });

    it('removes query parameters when they match default values', async () => {
        const onUrlUpdate = vi.fn();

        const dataSource = createDataSource('test/query-default-values', kExampleRowModel, {
            async authorize() {},
            async list(params) {
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData.slice(
                        params.page.offset, params.page.offset + params.page.limit),
                };
            },
        }).authorize(mocks.authenticationContext());

        const columns: Column<ExampleRowModel>[] = [{ field: 'name' }];

        render(
            <NuqsTestingAdapter searchParams="?page=2&pageSize=10" onUrlUpdate={onUrlUpdate}>
                <DataTable source={dataSource} columns={columns}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           listViewProps={{ primaryField: 'name' }} />
            </NuqsTestingAdapter>
        );

        await waitFor(() => {
            expect(screen.getByText('Yara Zale')).toBeDefined();
        });

        fireEvent.click(screen.getByTestId('navigate-back'));

        await waitFor(() => {
            expect(onUrlUpdate).toHaveBeenCalled();
        });

        const lastCall = onUrlUpdate.mock.lastCall![0];
        expect(lastCall.searchParams.has('page')).toBeFalsy();
        expect(lastCall.searchParams.get('pageSize')).toBe('10');
    });

    it('updates page to contain the currently visible entry when page size changes', async () => {
        const onUrlUpdate = vi.fn();

        const dataSource = createDataSource('test/query-page-size-adjust', kExampleRowModel, {
            async authorize() {},
            async list(params) {
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData.slice(
                        params.page.offset, params.page.offset + params.page.limit),
                };
            },
        }).authorize(mocks.authenticationContext());

        const columns: Column<ExampleRowModel>[] = [{ field: 'name' }];

        render(
            <NuqsTestingAdapter searchParams="?page=2&pageSize=10" onUrlUpdate={onUrlUpdate}>
                <DataTable source={dataSource} columns={columns}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           listViewProps={{ primaryField: 'name' }} />
            </NuqsTestingAdapter>
        );

        await waitFor(() => {
            expect(screen.getByText('Yara Zale')).toBeDefined();
        });

        const selectCombobox = screen.getByRole('combobox');
        fireEvent.mouseDown(selectCombobox);

        const option = await screen.findByRole('option', { name: '25' });
        fireEvent.click(option);

        await waitFor(() => {
            expect(onUrlUpdate).toHaveBeenCalled();
        });

        const lastCall = onUrlUpdate.mock.lastCall![0];
        expect(lastCall.searchParams.has('page')).toBeFalsy();
        expect(lastCall.searchParams.get('pageSize')).toBe('25');
    });
});
