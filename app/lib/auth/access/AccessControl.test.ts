// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { AccessControl, kAnyEvent, kAnyTeam, kPermissionPattern } from './AccessControl';
import { Cache } from '@lib/cache';
import { and, checkPermission, or } from './PermissionCheck';
import { initialisePermissionRoles } from './PermissionRoles';

describe('AccessControl', () => {
    it('validates permission syntax and rejects unknown or underscoped permissions', () => {
        const valid = [
            'foo', 'foo:create', 'foo:read', 'foo:update', 'foo:delete',
            'foo.bar', 'foo.bar:create', 'foo.bar:read', 'foo.bar:update', 'foo.bar:delete',
            'foo.bar.baz',
        ];
        const invalid = [ '', ' ', 'foo:unicorn', 'bar:unicorn', 'foo,bar', '1234', 'foo$bar' ];

        for (const pattern of valid)
            expect(kPermissionPattern.test(pattern), pattern).toBe(true);
        for (const pattern of invalid)
            expect(kPermissionPattern.test(pattern), pattern).toBe(false);

        const access = new AccessControl({ grants: 'test' });
        expect(() => access.query('bad,syntax' as any)).toThrow(/Invalid syntax/);
        expect(() => access.query('unknown.permission' as any)).toThrow(/Unrecognised/);

        // Required event/team scope enforcement:
        expect(() => access.query('test.boolean.required.both')).toThrow();
        expect(() => access.query('test.boolean.required.event')).toThrow();
        expect(() => access.query('test.boolean.required.team')).toThrow();
        expect(() => access.query('test.boolean.required.both', { event: '2024' })).toThrow();
        expect(() => access.query('test.boolean.required.team', { event: '2024' })).toThrow();
        expect(() => access.query('test.boolean.required.both', { team: 'crew' })).toThrow();
        expect(() => access.query('test.boolean.required.event', { team: 'crew' })).toThrow();

        expect(() => access.query('test.boolean.required.event', { event: '2024' })).not.toThrow();
        expect(() => access.query('test.boolean.required.team', { team: 'crew' })).not.toThrow();
        expect(() => access.query('test.boolean.required.both', { event: '2024', team: 'crew' }))
            .not.toThrow();
    });

    it('evaluates boolean, CRUD, and hierarchical grants and revokes with specificity', () => {
        const scope = { event: kAnyEvent, team: kAnyTeam };

        // Boolean grant + explicit revoke:
        const boolAccess = new AccessControl({
            grants: [ 'test', 'test.boolean.required.team' ],
            revokes: [ 'test.boolean.required.team' ],
        });
        expect(boolAccess.query('test.boolean.required.event', scope)).toEqual({
            result: 'granted', crud: false, expanded: true, global: true, scope: 'global',
        });
        expect(boolAccess.query('test.boolean.required.team', scope)).toEqual({
            result: 'revoked', crud: false, expanded: false, global: true, scope: 'global',
        });

        // CRUD explicit operation grant vs expanded parent grant vs explicit operation revoke:
        const fullCrud = new AccessControl({ grants: [ 'test.crud', 'test.crud:delete' ] });
        expect(fullCrud.query('test.boolean')).toBeUndefined();
        for (const op of [ 'create', 'read', 'update' ] as const) {
            expect(fullCrud.query('test.crud', op)).toEqual({
                result: 'granted', crud: false, expanded: true, global: true,
            });
        }
        expect(fullCrud.query('test.crud', 'delete')).toEqual({
            result: 'granted', crud: true, expanded: false, global: true,
        });

        const partialCrud = new AccessControl({ grants: 'test.crud', revokes: 'test.crud:delete' });
        expect(partialCrud.query('test.crud', 'create')).toEqual({
            result: 'granted', crud: false, expanded: true, global: true,
        });
        expect(partialCrud.query('test.crud', 'delete')).toEqual({
            result: 'revoked', crud: true, expanded: false, global: true,
        });

        // Hierarchical revoke overrides broader parent grant:
        const hierarchical = new AccessControl({ grants: 'test', revokes: 'test.boolean' });
        expect(hierarchical.query('test.crud', 'create')?.result).toBe('granted');
        expect(hierarchical.query('test.boolean')).toEqual({
            result: 'revoked', crud: false, expanded: false, global: true,
        });
        expect(hierarchical.query('test.boolean.required.both', scope)).toEqual({
            result: 'revoked', crud: false, expanded: true, global: true, scope: 'global',
        });
    });

    it('supports scoped revokes without blocking unrelated events or teams', () => {
        const access = new AccessControl({
            grants: 'test',
            revokes: [
                { permission: 'test.boolean', event: '2025', team: 'crew' },
                { permission: 'test.boolean.required.event', event: '2025' },
                { permission: 'test.boolean.required.team', team: 'crew' },
            ],
            events: kAnyEvent,
            teams: kAnyTeam,
        });

        // Unrestricted check fails when any scoped revoke exists, while non-revoked scopes pass:
        expect(access.can('test.boolean')).toBe(false);
        expect(access.can('test.boolean', { event: '2024' })).toBe(true);
        expect(access.can('test.boolean', { event: '2025' })).toBe(false);
        expect(access.can('test.boolean', { event: kAnyEvent })).toBe(true);
        expect(access.can('test.boolean', { team: 'hosts' })).toBe(true);
        expect(access.can('test.boolean', { team: 'crew' })).toBe(false);
        expect(access.can('test.boolean', { team: kAnyTeam })).toBe(true);

        expect(access.can('test.boolean.required.event', { event: '2024' })).toBe(true);
        expect(access.can('test.boolean.required.event', { event: '2025' })).toBe(false);
        expect(access.can('test.boolean.required.event', { event: kAnyEvent })).toBe(true);

        expect(access.can('test.boolean.required.team', { team: 'hosts' })).toBe(true);
        expect(access.can('test.boolean.required.team', { team: 'crew' })).toBe(false);
        expect(access.can('test.boolean.required.team', { team: kAnyTeam })).toBe(true);

        expect(access.can('test.crud', 'read')).toBe(true);
        expect(access.can('test.crud', 'read', { event: '2025', team: 'crew' })).toBe(true);
    });

    it('expands permission roles including nested revokes while respecting scopes', () => {
        const roles = Cache.getInstance('PermissionRoles');
        roles.set('restricted-role', {
            grants: [ 'test' ],
            revokes: [ 'test.boolean', 'test.crud:delete' ],
        });
        roles.set('parent-role', {
            grants: [ 'restricted-role' ],
            revokes: [],
        });

        const globalAccess = new AccessControl({ grants: 'parent-role' });
        expect(globalAccess.query('test.crud', 'read')).toEqual({
            result: 'granted', crud: false, expanded: true, global: true,
        });
        expect(globalAccess.can('test.crud', 'delete')).toBe(false);
        expect(globalAccess.can('test.boolean')).toBe(false);

        const scopedAccess = new AccessControl({
            grants: [ 'test', { permission: 'restricted-role', event: '2026', team: 'crew' } ],
            events: kAnyEvent,
            teams: kAnyTeam,
        });
        expect(scopedAccess.can('test.boolean', { event: '2025', team: 'crew' })).toBe(true);
        expect(scopedAccess.can('test.boolean', { event: '2026', team: 'crew' })).toBe(false);
        expect(scopedAccess.can('test.boolean', { event: '2026', team: 'hosts' })).toBe(true);

        // Explicit global revoke remains enforced across all scopes even alongside a scoped role
        // revoke for the same permission:
        const globalRevokeWithScopedRole = new AccessControl({
            grants: [ 'test', { permission: 'restricted-role', event: '2026', team: 'crew' } ],
            revokes: 'test.boolean',
            events: kAnyEvent,
            teams: kAnyTeam,
        });
        expect(globalRevokeWithScopedRole.can('test.boolean', { event: '2025', team: 'crew' }))
            .toBe(false);
        expect(globalRevokeWithScopedRole.can('test.boolean', { event: kAnyEvent, team: kAnyTeam }))
            .toBe(false);
    });

    it('evaluates event visibility and broad explicit grants across event/team matrices',
        async () =>
    {
        await initialisePermissionRoles([
            { role: 'staff', grants: 'event.visible' },
            { role: 'senior', grants: 'event.visible' },
        ]);

        const scoped = new AccessControl({
            grants: [
                { permission: 'staff', event: '2024', team: 'crew' },
                { permission: 'senior', event: '2023', team: 'hosts' },
            ],
            teams: 'example',
        });

        const cases: [ string, string, boolean ][] = [
            [ kAnyEvent, kAnyTeam, true ],
            [ '2022', kAnyTeam, false ], [ '2023', kAnyTeam, true ],
            [ '2024', kAnyTeam, true ],  [ '2025', kAnyTeam, false ],
            [ kAnyEvent, 'crew', true ], [ kAnyEvent, 'hosts', true ],
            [ kAnyEvent, 'example', true ], [ kAnyEvent, 'tech', false ],
            [ '2023', 'crew', false ],   [ '2024', 'crew', true ],
            [ '2023', 'hosts', true ],   [ '2024', 'hosts', false ],
            [ '2023', 'example', true ], [ '2024', 'example', true ],
            [ '2025', 'example', false ],
        ];

        for (const [ event, team, expected ] of cases)
            expect(scoped.can('event.visible', { event, team }), `${event}/${team}`).toBe(expected);

        // Explicit global grant applies across all events and teams even alongside scoped roles:
        const withoutExplicit = new AccessControl({
            grants: [ { permission: 'senior', event: '2025', team: 'stewards' } ],
            events: '2024',
            teams: 'name',
        });
        const withExplicit = new AccessControl({
            grants: [
                { permission: 'senior', event: '2025', team: 'stewards' },
                'event.settings',
            ],
            events: '2024',
            teams: 'name',
        });

        for (const scope of [
            { event: kAnyEvent, team: kAnyTeam },
            { event: '2024', team: kAnyTeam },
            { event: '2025', team: 'hosts' },
            { event: '2026', team: kAnyTeam },
        ]) {
            expect(withoutExplicit.can('event.settings', scope)).toBe(false);
            expect(withExplicit.can('event.settings', scope)).toBe(true);
        }
    });

    it('supports require() and composite checkPermission() with and() / or()', () => {
        const access = new AccessControl({
            grants: [
                'test.crud:update',
                { permission: 'event.settings', event: '2026' },
            ],
        });

        expect(() => access.require('test.boolean')).toThrow();
        expect(() => access.require('test.crud', 'read')).toThrow();
        expect(() => access.require('test.crud', 'update')).not.toThrow();

        expect(checkPermission(access, 'test.boolean')).toBe(false);
        expect(checkPermission(access, { permission: 'test.crud', operation: 'update' }))
            .toBe(true);
        expect(checkPermission(access, { permission: 'event.settings' }, { event: '2026' }))
            .toBe(true);
        expect(checkPermission(access, { permission: 'event.settings' }, { event: '2025' }))
            .toBe(false);

        expect(checkPermission(access, and(
            { permission: 'test.crud', operation: 'update' },
            { permission: 'event.settings', scope: { event: '2026' } },
        ))).toBe(true);

        expect(checkPermission(access, and(
            { permission: 'test.crud', operation: 'update' },
            'test.boolean',
        ))).toBe(false);

        expect(checkPermission(access, or(
            'test.boolean',
            { permission: 'test.crud', operation: 'update' },
        ))).toBe(true);

        expect(checkPermission(access, or(
            'test.boolean',
            { permission: 'test.crud', operation: 'delete' },
        ))).toBe(false);
    });
});
