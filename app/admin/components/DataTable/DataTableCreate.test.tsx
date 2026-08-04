// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('DataTable - Create', () => {
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

    it('is able to create a row via the footer button on desktop', async () => {
        let createInvokedWith: any = null;

        const dataSource = createDataSource('test/create-row-desktop', kExampleRowModel, {
            async authorize() {},
            async list(params) {
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData.slice(
                        params.page.offset, params.page.offset + params.page.limit),
                };
            },
            async create(row) {
                createInvokedWith = row;
                return true;
            },
        });

        const columns: Column<ExampleRowModel>[] = [
            { field: 'name', editable: true },
            { field: 'role', editable: true }
        ];

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

        // The button should be in the footer.
        const createBtn = screen.getByRole('button', { name: 'Create' });
        expect(createBtn).toBeDefined();

        // Click create button.
        fireEvent.click(createBtn);

        // Dialog should open.
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create item' })).toBeDefined();
        });

        // Fill form.
        const nameInput = screen.getByLabelText('name');
        const roleInput = screen.getByLabelText('role');
        fireEvent.change(nameInput, { target: { value: 'Zod Expert' } });
        fireEvent.change(roleInput, { target: { value: 'Tester' } });

        const submitBtn = screen.getByRole('button', { name: 'Create' });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(createInvokedWith).toEqual({ name: 'Zod Expert', role: 'Tester' });
        });
    });

    it('is able to create a row via the header button on desktop', async () => {
        let createInvokedWith: any = null;

        const dataSource = createDataSource('test/create-row-header-desktop', kExampleRowModel, {
            async authorize() {},
            async delete() { return true; },
            async list(params) {
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData.slice(
                        params.page.offset, params.page.offset + params.page.limit),
                };
            },
            async create(row) {
                createInvokedWith = row;
                return true;
            },
        });

        const columns: Column<ExampleRowModel>[] = [
            { field: 'name', editable: true },
            { field: 'role', editable: true }
        ];

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

        // The button should be in the header.
        const createBtn = screen.getByRole('button', { name: 'Create a new item' });
        expect(createBtn).toBeDefined();

        // Click create button.
        fireEvent.click(createBtn);

        // Dialog should open.
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create item' })).toBeDefined();
        });

        // Fill form.
        const nameInput = screen.getByLabelText('name');
        const roleInput = screen.getByLabelText('role');
        fireEvent.change(nameInput, { target: { value: 'Header Expert' } });
        fireEvent.change(roleInput, { target: { value: 'Tester' } });

        const submitBtn = screen.getByRole('button', { name: 'Create' });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(createInvokedWith).toEqual({ name: 'Header Expert', role: 'Tester' });
        });
    });

    it('is able to create a row via the footer button on mobile', async () => {
        let createInvokedWith: any = null;

        const dataSource = createDataSource('test/create-row-mobile', kExampleRowModel, {
            async authorize() {},
            async list(params) {
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData.slice(
                        params.page.offset, params.page.offset + params.page.limit),
                };
            },
            async create(row) {
                createInvokedWith = row;
                return true;
            },
        });

        const columns: Column<ExampleRowModel>[] = [
            { field: 'name', editable: true },
        ];

        mocks.useIsMobile.mockReturnValue(true);

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

        const createBtn = screen.getByRole('button', { name: 'Add item' });
        expect(createBtn).toBeDefined();

        fireEvent.click(createBtn);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create item' })).toBeDefined();
        });

        const nameInput = screen.getByLabelText('name');
        fireEvent.change(nameInput, { target: { value: 'Jack Reacher' } });

        const submitBtn = screen.getByRole('button', { name: 'Create' });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(createInvokedWith).toEqual({ name: 'Jack Reacher' });
        });
    });
});
