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

describe('DataTable - Search', () => {
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

    it.each([ 'prominent', 'subtle' ])('is able to use the %s quick search toolbar', async p => {
        const dataSource = createDataSource(`test/search-rows-${p}`, kExampleRowModel, {
            async authorize(operation, props, context) { /* no-op */ },
            async list(params) {
                const filteredExampleRowData = kExampleRowData.filter(({ name }) => {
                    if (!params.search)
                        return true;

                    return name.includes(params.search);
                });

                return {
                    rowCount: filteredExampleRowData.length,
                    rows: filteredExampleRowData.slice(
                        params.page.offset, params.page.offset + params.page.limit),
                };
            },
        }).authorize(mocks.authenticationContext());

        const columns: Column<ExampleRowModel>[] = [{ field: 'name' }];

        render(
            <NuqsTestingAdapter>
                <DataTable source={dataSource} columns={columns} search={p as 'prominent' | 'subtle'}
                           defaultSort={{ field: 'name', sort: 'asc' }} pageSize={10}
                           listViewProps={{ primaryField: 'name' }} />
            </NuqsTestingAdapter>
        );

        // The data will be made available asynchronously. Wait for it.
        await waitFor(() => {
            expect(screen.getByText('Quinn Reyes')).toBeDefined();
        });

        // The first ten rows are expected to be displayed, but not our target (ID 12):
        expect(screen.getByText('Sachi Tanaka')).toBeDefined();
        expect(() => screen.getByText('Wren Xavier')).toThrow();

        // Search for "Xavier":
        fireEvent.change(screen.getByRole('searchbox'), {
            target: { value: 'Xavier' },
        });

        // Wait for the filtered data to be made available asynchronously.
        await waitFor(() => {
            expect(screen.getByText('Wren Xavier')).toBeDefined();
        });
    });

    it('respects the search query parameter from the URL', async () => {
        let requestedSearch: string | undefined;

        const dataSource = createDataSource('test/search-query-param', kExampleRowModel, {
            async authorize() {},
            async list(params) {
                requestedSearch = params.search;
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData.slice(
                        params.page.offset, params.page.offset + params.page.limit),
                };
            },
        }).authorize(mocks.authenticationContext());

        const columns: Column<ExampleRowModel>[] = [{ field: 'name' }];

        render(
            <NuqsTestingAdapter searchParams="?q=Xavier">
                <DataTable source={dataSource} columns={columns}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           listViewProps={{ primaryField: 'name' }} />
            </NuqsTestingAdapter>
        );

        await waitFor(() => {
            expect(requestedSearch).toBeDefined();
        });

        expect(requestedSearch).toBe('Xavier');
    });

    it('updates URL query parameters when searching is changed', async () => {
        const onUrlUpdate = vi.fn();

        const dataSource = createDataSource('test/search-url-update', kExampleRowModel, {
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
            <NuqsTestingAdapter searchParams="" onUrlUpdate={onUrlUpdate}>
                <DataTable source={dataSource} columns={columns} search="prominent"
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           listViewProps={{ primaryField: 'name' }} />
            </NuqsTestingAdapter>
        );

        await waitFor(() => {
            expect(screen.getByRole('searchbox')).toBeDefined();
        });

        fireEvent.change(screen.getByRole('searchbox'), {
            target: { value: 'Xavier' },
        });

        await waitFor(() => {
            expect(onUrlUpdate).toHaveBeenCalled();
        });

        const lastCall = onUrlUpdate.mock.lastCall![0];
        expect(lastCall.searchParams.get('q')).toBe('Xavier');
    });

    it('removes search query parameters when they are empty', async () => {
        const onUrlUpdate = vi.fn();

        const dataSource = createDataSource('test/search-empty-remove', kExampleRowModel, {
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
            <NuqsTestingAdapter searchParams="?q=Xavier" onUrlUpdate={onUrlUpdate}>
                <DataTable source={dataSource} columns={columns} search="prominent"
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           listViewProps={{ primaryField: 'name' }} />
            </NuqsTestingAdapter>
        );

        await waitFor(() => {
            expect(screen.getByRole('searchbox')).toBeDefined();
        });

        fireEvent.change(screen.getByRole('searchbox'), {
            target: { value: '' },
        });

        await waitFor(() => {
            expect(onUrlUpdate).toHaveBeenCalled();
        });

        const lastCall = onUrlUpdate.mock.lastCall![0];
        expect(lastCall.searchParams.has('q')).toBeFalsy();
    });
});
