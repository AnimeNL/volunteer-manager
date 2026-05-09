// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden } from 'next/navigation';
import { z } from 'zod';

import type { GridGetRowsParams } from '@mui/x-data-grid-premium';

import type { AuthenticationContext } from '@lib/auth/AuthenticationContext';
import { AccessControl } from '@lib/auth/AccessControl';
import { DataSourceWrapper } from './DataSourceWrapper';
import { withContext, withRowModel } from './';

const mocks = vi.hoisted(() => ({
    authenticationContext: vi.fn(),
}));

vi.mock('@lib/auth/AuthenticationContext', () => ({
    getAuthenticationContext: async () => mocks.authenticationContext(),
}));

describe('DataSourceWrapper', () => {
    const kEmptyContext = withContext({ /* empty */ });
    const kBasicContext = withContext({
        category: z.enum([ 'books', 'games', 'music' ]),
    });

    const kBasicRowModel = withRowModel({
        id: z.number(),
        name: z.string(),
    });

    const kDefaultListParams: GridGetRowsParams = {
        sortModel: [ /* no sort model */ ],
        filterModel: {
            items: [ /* no items */ ],
        },
        start: 0,
        end: 0,
    };

    // Mock the obtained AuthenticationContext as if it were a signed in user with a decent scope
    // in regards to permissions. This is the default mock value, which may be overridden by tests.
    beforeEach(() => {
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
    });

    it('validates that an "id" property exists on the row model', () => {
        assert.throw(() => {
            new DataSourceWrapper(kEmptyContext, withRowModel({
                // observe that `id` is missing
            }), { /* empty */ } as any);
        }, /required to have an "id" field/);
    });

    it('disallows unauthenticated calls by default', async () => {
        mocks.authenticationContext.mockReturnValue({
            access: new AccessControl({ /* no grants */ }),
            user: undefined,
        } satisfies AuthenticationContext);

        const wrapper = new DataSourceWrapper(kEmptyContext, kBasicRowModel, {
            async authorize(operation, props, context) { /* no-op */ },
        });

        await expect(wrapper.call('list', { /* empty */ }, kDefaultListParams))
            .rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;401/);
    });

    it('can optionally allow unauthenticated calls through the DataSource', async () => {
        mocks.authenticationContext.mockReturnValue({
            access: new AccessControl({ /* no grants */ }),
            user: undefined,
        } satisfies AuthenticationContext);

        const wrapper = new DataSourceWrapper(kEmptyContext, kBasicRowModel, {
            allowUnauthenticated: () => true,  // <----
            async authorize(operation, props, context) { /* no-op */ },
        });

        const rows = await wrapper.call('list', { /* empty */ }, kDefaultListParams);
        expect(rows.rowCount).toBe(0);
        expect(rows.rows).toHaveLength(0);
    });

    it('can fail when a call cannot be appropriately authorized', async () => {
        const wrapper = new DataSourceWrapper(kEmptyContext, kBasicRowModel, {
            async authorize(operation, props, context) {
                if (!props.access.can('admin'))
                    forbidden();
            },
        });

        await expect(wrapper.call('list', { /* empty */ }, kDefaultListParams))
            .rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;403/);
    });

    it('can fail when the necessary context has not been provided', async () => {
        const wrapper = new DataSourceWrapper(kBasicContext, kBasicRowModel, {
            async authorize(operation, props, context) { /* no-op */ },
        });

        await expect(wrapper.call('list', { /* empty */ }, kDefaultListParams))
            .rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);

        const rows = await wrapper.call('list', { category: 'games' }, kDefaultListParams);
        expect(rows.rowCount).toBe(0);
        expect(rows.rows).toHaveLength(0);
    });

    it('is able to both validate and transform the context', async () => {
        const multiplyingContext = withContext({
            value: z.number().transform(v => v * 2),
        });

        let receivedValue: number | undefined;

        const wrapper = new DataSourceWrapper(multiplyingContext, kBasicRowModel, {
            async authorize(operation, props, context) {
                receivedValue = context.value;
            },
        });

        const rows = await wrapper.call('list', { value: 21 }, kDefaultListParams);
        expect(rows.rowCount).toBe(0);
        expect(rows.rows).toHaveLength(0);

        expect(receivedValue).toBe(42);
    });

    it('is able to execute list() operations', async () => {
        const wrapper = new DataSourceWrapper(kEmptyContext, kBasicRowModel, {
            async authorize(operation, props, context) { /* no-op */ },
            async list(params, props, context) {
                return {
                    rowCount: 42,
                    rows: [
                        {
                            id: 1,
                            name: 'John Doe',
                        },
                    ],
                };
            }
        });

        const rows = await wrapper.call('list', { /* empty */ }, kDefaultListParams);
        expect(rows.rowCount).toBe(42);

        expect(rows.rows).toHaveLength(1);
        expect(rows.rows[0].id).toBe(1);
        expect(rows.rows[0].name).toBe('John Doe');
    });
});
