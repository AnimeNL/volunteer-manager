// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Cache } from '@lib/cache';
import { SetRecordErrorLogDeferDelegate } from '@lib/ErrorLog';
import { buildAuthenticationContext } from '@lib/auth/AuthenticationTestHelpers';
import { useMockConnection } from '@lib/database/Connection';

import { updateAccountPermissions, updateRolePermissions } from './PermissionActions';

const mockInvalidateAuthCache = vi.fn();

let currentAdminGrants = 'system.permissions';

vi.mock('next/headers', () => ({
    headers: async () => new Headers(),
}));

vi.mock('@lib/auth', async importOriginal => {
    const actual = await importOriginal<typeof import('@lib/auth')>();

    const buildAdminContext = () => buildAuthenticationContext({
        access: {
            grants: currentAdminGrants,
            events: '*',
            teams: '*',
        },
        user: {
            id: 42,
            firstName: 'Admin',
            lastName: 'User',
            name: 'Admin User',
            nameOrFirstName: 'Admin',
            username: 'admin@animecon.nl',
        },
    });

    return {
        ...actual,
        getAuthenticationContext: async () => buildAdminContext(),
        invalidateAuthCache: (...args: unknown[]) => mockInvalidateAuthCache(...args),
        requireAuthenticationContext: async () => buildAdminContext(),
    };
});

vi.mock('@lib/log', () => ({
    LogBuilder: {
        for: () => {
            const builder = {
                withAffectedUser: () => builder,
                withCondition: () => builder,
                withDiff: () => builder,
                withInitiatorUser: () => builder,
                withSeverity: () => builder,
                record: vi.fn(),
            };
            return builder;
        },
    },
}));

describe('PermissionActions', () => {
    const mockConnection = useMockConnection();

    beforeEach(() => {
        currentAdminGrants = 'system.permissions';
        mockInvalidateAuthCache.mockReset();
        Cache.getInstance('PermissionRoles').clear();
        SetRecordErrorLogDeferDelegate(async () => undefined);
    });

    afterEach(() => {
        SetRecordErrorLogDeferDelegate(undefined);
    });

    it('blocks non-root administrators from updating a root user', async () => {
        mockConnection.expect('selectOneRow', () => ({
            id: 99,
            grants: 'root',
            revokes: null,
            events: '*',
            teams: '*',
        }));

        const result = await updateAccountPermissions(99, {
            grants: {},
            revokes: {},
            events: [],
            teams: [],
            roles: [],
        });

        expect(result).toEqual({
            success: false,
            error: 'You are not allowed to update these permissions…',
        });
        expect(mockInvalidateAuthCache).not.toHaveBeenCalled();
    });

    it('rejects unknown roles and blocks non-root admins from assigning the root role', async () => {
        const normalUser = {
            id: 55,
            grants: 'event.visible',
            revokes: null,
            events: '2026',
            teams: 'stewards',
        };

        mockConnection.expect('selectOneRow', () => normalUser);
        mockConnection.expect('selectManyRows', () => [
            { id: 'senior', grants: 'event.visible,event.hotels' },
        ]);

        const unknownRole = await updateAccountPermissions(55, {
            grants: {},
            revokes: {},
            events: [],
            teams: [],
            roles: [ 'nonexistent' ],
        });
        expect(unknownRole).toEqual({
            success: false,
            error: 'Unknown permission role: "nonexistent"',
        });

        mockConnection.expect('selectOneRow', () => normalUser);
        mockConnection.expect('selectManyRows', () => [
            { id: 'senior', grants: 'event.visible,event.hotels' },
        ]);

        const rootEscalation = await updateAccountPermissions(55, {
            grants: {},
            revokes: {},
            events: [],
            teams: [],
            roles: [ 'root' ],
        });
        expect(rootEscalation).toEqual({
            success: false,
            error: 'You are not allowed to assign the "root" role…',
        });
    });

    it('updates account grants, revokes, roles, and normalizes wildcard scopes', async () => {
        mockConnection.expect('selectOneRow', () => ({
            id: 55,
            grants: 'event.visible',
            revokes: null,
            events: '2025',
            teams: 'stewards',
        }));
        mockConnection.expect('selectManyRows', () => [
            { id: 'senior', grants: 'event.visible,event.hotels' },
        ]);

        let updateParams: unknown[] = [];
        mockConnection.expect('update', (_query, params) => {
            updateParams = params;
            return 1;
        });

        const result = await updateAccountPermissions(55, {
            grants: { 'event.visible': true },
            revokes: { 'event.trainings': true },
            events: [ '2026', '*' ],
            teams: [ 'stewards', '*' ],
            roles: [ 'senior' ],
        });

        expect(result).toEqual({ success: true, refresh: true });
        expect(updateParams).toContain('senior,event.visible');
        expect(updateParams).toContain('event.trainings');
        expect(updateParams).toContain('*');
        expect(mockInvalidateAuthCache).toHaveBeenCalledWith(55);
    });

    it('refuses to modify the root role even for root administrators', async () => {
        currentAdminGrants = 'root';

        const result = await updateRolePermissions('root', {
            grants: { 'event.visible': true },
            revokes: {},
        });

        expect(result).toEqual({
            success: false,
            error: 'The root role cannot be modified',
        });
        expect(mockInvalidateAuthCache).not.toHaveBeenCalled();
    });

    it('blocks non-root administrators from modifying a role that grants root', async () => {
        mockConnection.expect('selectOneRow', () => ({
            id: 'superadmin',
            grants: 'root',
            revokes: null,
        }));

        const result = await updateRolePermissions('superadmin', {
            grants: { 'event.visible': true },
            revokes: {},
        });

        expect(result).toEqual({
            success: false,
            error: 'You are not allowed to update these permissions…',
        });
        expect(mockInvalidateAuthCache).not.toHaveBeenCalled();
    });

    it('updates role permissions, refreshes PermissionRoles cache, and invalidates auth cache', async () => {
        mockConnection.expect('selectOneRow', () => ({
            id: 'senior',
            grants: 'event.visible',
            revokes: null,
        }));
        mockConnection.expect('update', () => 1);

        const result = await updateRolePermissions('senior', {
            grants: { 'event.visible': true, 'event.hotels': true },
            revokes: { 'event.trainings': true },
        });

        expect(result).toEqual({ success: true, refresh: true });
        expect(Cache.getInstance('PermissionRoles').get('senior')).toEqual({
            grants: [ 'event.visible', 'event.hotels' ],
            revokes: [ 'event.trainings' ],
        });
        expect(mockInvalidateAuthCache).toHaveBeenCalledWith();
    });
});
