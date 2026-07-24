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

describe('DataTable - Update', () => {
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
    ];

    it('is able to update a row on desktop', async () => {
        let updateInvokedWith: any = null;
        let updatePreviousInvokedWith: any = null;

        const dataSource = createDataSource('test/update-row', kExampleRowModel, {
            async authorize() {},
            async list(params) {
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData.slice(
                        params.page.offset, params.page.offset + params.page.limit),
                };
            },
            async update(params, previousParams) {
                updateInvokedWith = params;
                updatePreviousInvokedWith = previousParams;
                return true;
            },
        });

        const columns: Column<ExampleRowModel>[] = [{ field: 'name', editable: true }];

        render(
            <NuqsTestingAdapter searchParams="" onUrlUpdate={vi.fn()}>
                <DataTable source={dataSource} columns={columns}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           listViewProps={{ primaryField: 'name' }} />
            </NuqsTestingAdapter>
        );

        await waitFor(() => {
            expect(screen.getByText('Amia Bell')).toBeDefined();
        });

        const cell = screen.getByText('Amia Bell');
        fireEvent.doubleClick(cell);

        const input = await screen.findByDisplayValue('Amia Bell');
        fireEvent.change(input, { target: { value: 'Amia Ring' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
            expect(updateInvokedWith).toEqual({ id: 1, name: 'Amia Ring', role: 'Manager' });
            expect(updatePreviousInvokedWith).toEqual({ id: 1, name: 'Amia Bell', role: 'Manager' });
        });
    });

    it('shows an error if the update fails', async () => {
        const dataSource = createDataSource('test/update-row-fail', kExampleRowModel, {
            async authorize() {},
            async list(params) {
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData.slice(
                        params.page.offset, params.page.offset + params.page.limit),
                };
            },
            async update(params, previousParams) {
                return false;
            },
        });

        const columns: Column<ExampleRowModel>[] = [{ field: 'name', editable: true }];

        render(
            <NuqsTestingAdapter searchParams="" onUrlUpdate={vi.fn()}>
                <DataTable source={dataSource} columns={columns}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           listViewProps={{ primaryField: 'name' }} />
            </NuqsTestingAdapter>
        );

        await waitFor(() => {
            expect(screen.getByText('Amia Bell')).toBeDefined();
        });

        const cell = screen.getByText('Amia Bell');
        fireEvent.doubleClick(cell);

        const input = await screen.findByDisplayValue('Amia Bell');
        fireEvent.change(input, { target: { value: 'Amia Ring' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
            expect(screen.getByText('Failed to update the row')).toBeDefined();
        });
    });
});
