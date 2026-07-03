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

describe('DataTable - Delete', () => {
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

    it('is able to delete a row on desktop', async () => {
        let deleteInvokedWith: any = null;

        const dataSource = createDataSource('test/delete-row', kExampleRowModel, {
            async authorize() {},
            async list(params) {
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData.slice(
                        params.page.offset, params.page.offset + params.page.limit),
                };
            },
            async delete(params) {
                deleteInvokedWith = params;
                return true;
            },
        }).authorize(mocks.authenticationContext());

        const columns: Column<ExampleRowModel>[] = [{ field: 'name' }];

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

        const deleteButtons = screen.getAllByRole('button', { name: 'Delete this item' });
        expect(deleteButtons.length).toBeGreaterThan(0);
        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('Delete this item?')).toBeDefined();
        });

        const confirmButton = screen.getByRole('button', { name: 'Delete' });
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(deleteInvokedWith).toEqual({ id: 1, name: 'Amia Bell', role: 'Manager' });
        });
    });

    it('is able to delete a row on mobile', async () => {
        let deleteInvokedWith: any = undefined;

        const dataSource = createDataSource('test/delete-row-mobile', kExampleRowModel, {
            async authorize() {},
            async list(params) {
                return {
                    rowCount: kExampleRowData.length,
                    rows: kExampleRowData.slice(
                        params.page.offset, params.page.offset + params.page.limit),
                };
            },
            async delete(params) {
                deleteInvokedWith = params;
                return true;
            },
        }).authorize(mocks.authenticationContext());

        const columns: Column<ExampleRowModel>[] = [{ field: 'name' }];

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

        // On mobile, the row actions IconButton with MoreVert should be present.
        const actionButtons = screen.getAllByRole('button', { name: 'Actions' });
        expect(actionButtons.length).toBeGreaterThan(0);
        fireEvent.click(actionButtons[0]);

        // After clicking the action button, the menu items "Edit" and "Delete" should be shown.
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete' })).toBeDefined();
        });

        const deleteMenuItem = screen.getByRole('button', { name: 'Delete' });
        fireEvent.click(deleteMenuItem);

        // Clicking delete menu item should open the confirmation dialog.
        await waitFor(() => {
            expect(screen.getByText('Delete this item?')).toBeDefined();
        });

        const confirmButton = screen.getByRole('button', { name: 'Delete' });
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(deleteInvokedWith).toEqual({ id: 1, name: 'Amia Bell', role: 'Manager' });
        });
    });
});
