// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden } from 'next/navigation';
import { z } from 'zod';

import type { GridGetRowsParams } from '@mui/x-data-grid-premium';

import type { AuthenticationContext } from '@lib/auth/AuthenticationContext';
import { AccessControl } from '@lib/auth/AccessControl';
import { DataSourceWrapper } from './DataSourceWrapper';
import { SetRecordErrorLogDeferDelegate } from '@lib/Log';
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

    const kDefaultDataSourceId = 'my-data-source';

    const kDefaultListParams: GridGetRowsParams = {
        sortModel: [ /* no sort model */ ],
        filterModel: {
            items: [ /* no items */ ],
        },
        start: 0,
        end: 0,
    };

    let errorLogDelegateInvoked: boolean = false;

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

        errorLogDelegateInvoked = false;
        SetRecordErrorLogDeferDelegate(() => {
            errorLogDelegateInvoked = true;
        });
    });

    afterEach(() => {
        SetRecordErrorLogDeferDelegate(/* delegate= */ undefined);
    });

    it('validates that an "id" property exists on the row model', () => {
        assert.throw(() => {
            new DataSourceWrapper(kEmptyContext, withRowModel({
                // observe that `id` is missing
            }), kDefaultDataSourceId, { /* empty */ } as any);
        }, /required to have an "id" field/);
    });

    it('disallows unauthenticated calls by default', async () => {
        mocks.authenticationContext.mockReturnValue({
            access: new AccessControl({ /* no grants */ }),
            user: undefined,
        } satisfies AuthenticationContext);

        const wrapper = new DataSourceWrapper(kEmptyContext, kBasicRowModel, kDefaultDataSourceId, {
            async authorize(operation, props, context) { /* no-op */ },
        });

        await expect(wrapper.call('list', { /* empty */ }, kDefaultListParams))
            .rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;401/);

        expect(errorLogDelegateInvoked).toBeTruthy();
    });

    it('can optionally allow unauthenticated calls through the DataSource', async () => {
        mocks.authenticationContext.mockReturnValue({
            access: new AccessControl({ /* no grants */ }),
            user: undefined,
        } satisfies AuthenticationContext);

        const wrapper = new DataSourceWrapper(kEmptyContext, kBasicRowModel, kDefaultDataSourceId, {
            allowUnauthenticated: () => true,  // <----
            async authorize(operation, props, context) { /* no-op */ },
        });

        const rows = await wrapper.call('list', { /* empty */ }, kDefaultListParams);
        expect(rows.rowCount).toBe(0);
        expect(rows.rows).toHaveLength(0);

        expect(errorLogDelegateInvoked).toBeFalsy();
    });

    it('can fail when a call cannot be appropriately authorized', async () => {
        const wrapper = new DataSourceWrapper(kEmptyContext, kBasicRowModel, kDefaultDataSourceId, {
            async authorize(operation, props, context) {
                if (!props.access.can('admin'))
                    forbidden();
            },
        });

        await expect(wrapper.call('list', { /* empty */ }, kDefaultListParams))
            .rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;403/);

        expect(errorLogDelegateInvoked).toBeFalsy();  // TODO: Consider whether we should catch?
    });

    it('can fail when the necessary context has not been provided', async () => {
        const wrapper = new DataSourceWrapper(kBasicContext, kBasicRowModel, kDefaultDataSourceId, {
            async authorize(operation, props, context) { /* no-op */ },
        });

        await expect(wrapper.call('list', { /* empty */ }, kDefaultListParams))
            .rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);

        expect(errorLogDelegateInvoked).toBeTruthy();

        const rows = await wrapper.call('list', { category: 'games' }, kDefaultListParams);
        expect(rows.rowCount).toBe(0);
        expect(rows.rows).toHaveLength(0);
    });

    it('is able to both validate and transform the context', async () => {
        const multiplyingContext = withContext({
            value: z.number().transform(v => v * 2),
        });

        let receivedValue: number | undefined;

        const wrapper = new DataSourceWrapper(multiplyingContext, kBasicRowModel, kDefaultDataSourceId, {
            async authorize(operation, props, context) {
                receivedValue = context.value;
            },
        });

        const rows = await wrapper.call('list', { value: 21 }, kDefaultListParams);
        expect(rows.rowCount).toBe(0);
        expect(rows.rows).toHaveLength(0);

        expect(receivedValue).toBe(42);
    });

    it('is able to execute create() operations', async () => {
        const wrapper = new DataSourceWrapper(kEmptyContext, kBasicRowModel, kDefaultDataSourceId, {
            async authorize(operation, props, context) { /* no-op */ },
            async list(params, props, context) {
                return {
                    rowCount: 0,
                    rows: [ /* none */ ],
                };
            },
            async create(props, context) {
                return {
                    id: 42,
                    name: 'John Doe',
                };
            },
        });

        const row = await wrapper.call('create', { /* empty */ });
        expect(row.id).toBe(42);
        expect(row.name).toBe('John Doe');

        expect(errorLogDelegateInvoked).toBeFalsy();
    });

    it('is able to execute list() operations', async () => {
        const wrapper = new DataSourceWrapper(kEmptyContext, kBasicRowModel, kDefaultDataSourceId, {
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

        expect(errorLogDelegateInvoked).toBeFalsy();
    });

    it('is able to execute delete() operations', async () => {
        let deletedId: number | undefined;
        let deletedName: string | undefined;

        const wrapper = new DataSourceWrapper(kEmptyContext, kBasicRowModel, kDefaultDataSourceId, {
            async authorize(operation, props, context) { /* no-op */ },
            async delete(params, props, context) {
                deletedId = params.id;
                deletedName = params.name;
                return true;
            },
        });

        const success = await wrapper.call('delete', { /* empty */ }, { id: 42, name: 'John Doe' });
        expect(success).toBe(true);

        expect(deletedId).toBe(42);
        expect(deletedName).toBe('John Doe');

        expect(errorLogDelegateInvoked).toBeFalsy();
    });
});
