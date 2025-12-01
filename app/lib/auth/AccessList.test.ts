// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { AccessList, kAnyEvent, kAnyTeam } from './AccessList';

describe('AccessList', () => {
    it('should be able to run queries against basic permissions', () => {
        const singleAccessList = new AccessList({ grants: 'foo.bar' });
        expect(singleAccessList.query('foo')).toBeUndefined();
        expect(singleAccessList.query('foo.baz')).toBeUndefined();

        expect(singleAccessList.query('foo.bar')).not.toBeUndefined();
        expect(singleAccessList.query('foo.bar')).toEqual({
            expanded: false,
            global: true,
        });

        const multipleAccessList = new AccessList({ grants: 'foo.bar,foo.baz' });
        expect(multipleAccessList.query('foo')).toBeUndefined();

        expect(multipleAccessList.query('foo.bar')).not.toBeUndefined();
        expect(multipleAccessList.query('foo.bar')).toEqual({
            expanded: false,
            global: true,
        });

        expect(multipleAccessList.query('foo.baz')).not.toBeUndefined();
        expect(multipleAccessList.query('foo.baz')).toEqual({
            expanded: false,
            global: true,
        });

        const arrayAccessList = new AccessList({ grants: [ 'foo.bar', 'foo.baz' ] });
        expect(arrayAccessList.query('foo')).toBeUndefined();

        expect(arrayAccessList.query('foo.bar')).toEqual(multipleAccessList.query('foo.bar'));
        expect(arrayAccessList.query('foo.baz')).toEqual(multipleAccessList.query('foo.baz'));
    });

    it('should ignore scope when querying for globally granted permissions', () => {
        const singleAccessList = new AccessList({ grants: 'foo.bar' });
        expect(singleAccessList.query('foo.bar')).toEqual({
            expanded: false,
            global: true,
        });

        expect(singleAccessList.query('foo.bar', { event: '2024' })).toEqual({
            expanded: false,
            global: true,
            scope: 'global',
        });

        expect(singleAccessList.query('foo.bar', { team: 'example' })).toEqual({
            expanded: false,
            global: true,
            scope: 'global',
        });

        expect(singleAccessList.query('foo.bar', { event: '2024', team: 'example' })).toEqual({
            expanded: false,
            global: true,
            scope: 'global',
        });
    });

    it('should be able to run queries against expanded permissions', () => {
        const expansions = {
            test: [
                'test.foo',
                'test.bar',
                'test2',
            ],
        };

        const expandedAccessList = new AccessList({ expansions, grants: 'test' });
        expect(expandedAccessList.query('example')).toBeUndefined();
        expect(expandedAccessList.query('test.qux')).toBeUndefined();

        expect(expandedAccessList.query('test')).not.toBeUndefined();
        expect(expandedAccessList.query('test')).toEqual({
            expanded: false,
            global: true,
        });

        expect(expandedAccessList.query('test.foo')).not.toBeUndefined();
        expect(expandedAccessList.query('test.foo')).toEqual({
            expanded: true,
            global: true,
        });

        expect(expandedAccessList.query('test.bar')).not.toBeUndefined();
        expect(expandedAccessList.query('test.bar')).toEqual({
            expanded: true,
            global: true,
        });

        expect(expandedAccessList.query('test2')).not.toBeUndefined();
        expect(expandedAccessList.query('test2')).toEqual({
            expanded: true,
            global: true,
        });
    });

    it('should support nested permission expansion lists', () => {
        const expansions = {
            test: [
                'test.foo',
                'test2',  // <-- nested
            ],
            test2: [
                'test.bar',
                'test3',
            ],
        };

        const nestedAccessList = new AccessList({ expansions, grants: 'test' });
        expect(nestedAccessList.query('test')).not.toBeUndefined();
        expect(nestedAccessList.query('test')).toEqual({
            expanded: false,
            global: true,
        });

        expect(nestedAccessList.query('test.foo')).not.toBeUndefined();
        expect(nestedAccessList.query('test.foo')).toEqual({
            expanded: true,
            global: true,
        });

        expect(nestedAccessList.query('test.bar')).not.toBeUndefined();
        expect(nestedAccessList.query('test.bar')).toEqual({
            expanded: true,
            global: true,
        });

        expect(nestedAccessList.query('test2')).not.toBeUndefined();
        expect(nestedAccessList.query('test2')).toEqual({
            expanded: true,
            global: true,
        });

        expect(nestedAccessList.query('test3')).not.toBeUndefined();
        expect(nestedAccessList.query('test3')).toEqual({
            expanded: true,
            global: true,
        });
    });

    it('should protect against loops in permission expansion lists', () => {
        const expansions = {
            test: [
                'test.foo',
                'test',  // <-- circular
            ],
        };

        const nestedAccessList = new AccessList({ expansions, grants: 'test' });
        expect(nestedAccessList.query('test')).not.toBeUndefined();
        expect(nestedAccessList.query('test.foo')).not.toBeUndefined();
        expect(nestedAccessList.query('test.bar')).toBeUndefined();
    });

    it('should track whether permissions were listed with global or scoped access', () => {
        const accessList = new AccessList({
            grants: [
                { permission: 'test' },
                { permission: 'test.foo' },
                { permission: 'test', event: '2024' },
                { permission: 'test.bar', event: '2024' },
            ],
        });

        expect(accessList.query('test')).not.toBeUndefined();
        expect(accessList.query('test')).toEqual({
            expanded: false,
            global: true,
        });

        expect(accessList.query('test.foo')).not.toBeUndefined();
        expect(accessList.query('test.foo')).toEqual({
            expanded: false,
            global: true,
        });

        expect(accessList.query('test.bar')).not.toBeUndefined();
        expect(accessList.query('test.bar')).toEqual({
            expanded: false,
            global: false,
        });

        const expandedAccessList = new AccessList({
            expansions: {
                test: [
                    'test.foo',
                ],
            },
            grants: [
                { permission: 'test,test.qux', event: '2024' },
                { permission: 'test,test.bar' },
            ],
        });

        expect(expandedAccessList.query('test')).not.toBeUndefined();
        expect(expandedAccessList.query('test')).toEqual({
            expanded: false,
            global: true,
        });

        expect(expandedAccessList.query('test.foo')).not.toBeUndefined();
        expect(expandedAccessList.query('test.foo')).toEqual({
            expanded: true,
            global: true,
        });

        expect(expandedAccessList.query('test.bar')).not.toBeUndefined();
        expect(expandedAccessList.query('test.bar')).toEqual({
            expanded: false,
            global: true,
        });

        expect(expandedAccessList.query('test.qux')).not.toBeUndefined();
        expect(expandedAccessList.query('test.qux')).toEqual({
            expanded: false,
            global: false,
        });
    });

    it('should be able to adhere to permission queries scoped to an event', () => {
        const scopedAccessList = new AccessList({
            expansions: {
                test: [
                    'test2',
                ],
            },
            grants: [
                { permission: 'test', event: '2024' },
                { permission: 'test2', event: '2025' },
            ],
        });

        expect(scopedAccessList.query('test')).not.toBeUndefined();
        expect(scopedAccessList.query('test')).toEqual({
            expanded: false,
            global: false,
        });

        expect(scopedAccessList.query('test', { event: '2024' })).not.toBeUndefined();
        expect(scopedAccessList.query('test', { event: '2024' })).toEqual({
            expanded: false,
            global: false,
            scope: {
                event: '2024',
            },
        });

        expect(scopedAccessList.query('test', { event: '2025' })).toBeUndefined();

        expect(scopedAccessList.query('test2')).not.toBeUndefined();
        expect(scopedAccessList.query('test2')).toEqual({
            expanded: false,
            global: false,
        });

        expect(scopedAccessList.query('test2', { event: '2024' })).not.toBeUndefined();
        expect(scopedAccessList.query('test2', { event: '2024' })).toEqual({
            expanded: false,
            global: false,
            scope: {
                event: '2024',
            },
        });

        expect(scopedAccessList.query('test2', { event: '2025' })).not.toBeUndefined();
        expect(scopedAccessList.query('test2', { event: '2025' })).toEqual({
            expanded: false,
            global: false,
            scope: {
                event: '2025',
            },
        });

        expect(scopedAccessList.query('test', { event: '2026' })).toBeUndefined();
        expect(scopedAccessList.query('test2', { event: '2026' })).toBeUndefined();
    });

    it('should be able to adhere to permission queries scoped to a team', () => {
        const scopedAccessList = new AccessList({
            expansions: {
                test: [
                    'test2',
                ],
            },
            grants: [
                { permission: 'test', team: 'crew' },
                { permission: 'test2', team: 'stewards' },
            ],
        });

        expect(scopedAccessList.query('test')).not.toBeUndefined();
        expect(scopedAccessList.query('test')).toEqual({
            expanded: false,
            global: false,
        });

        expect(scopedAccessList.query('test', { team: 'crew' })).not.toBeUndefined();
        expect(scopedAccessList.query('test', { team: 'crew' })).toEqual({
            expanded: false,
            global: false,
            scope: {
                team: 'crew',
            },
        });

        expect(
            scopedAccessList.query('test', { event: '2024', team: 'crew' })).toEqual(
            scopedAccessList.query('test', { event: '2025', team: 'crew' }));

        expect(scopedAccessList.query('test', { team: 'stewards' })).toBeUndefined();

        expect(
            scopedAccessList.query('test', { event: '2024', team: 'stewards' })).toEqual(
            scopedAccessList.query('test', { event: '2025', team: 'stewards' }));

        expect(scopedAccessList.query('test2')).not.toBeUndefined();
        expect(scopedAccessList.query('test2')).toEqual({
            expanded: false,
            global: false,
        });

        expect(scopedAccessList.query('test2', { team: 'crew' })).not.toBeUndefined();
        expect(scopedAccessList.query('test2', { team: 'crew' })).toEqual({
            expanded: false,
            global: false,
            scope: {
                team: 'crew',
            },
        });

        expect(scopedAccessList.query('test2', { team: 'stewards' })).not.toBeUndefined();
        expect(scopedAccessList.query('test2', { team: 'stewards' })).toEqual({
            expanded: false,
            global: false,
            scope: {
                team: 'stewards',
            },
        });

        expect(scopedAccessList.query('test', { team: 'hosts' })).toBeUndefined();
        expect(scopedAccessList.query('test2', { team: 'hosts' })).toBeUndefined();
    });

    it('should be able to adhere to permission queries scoped to both an event and a team', () => {
        const scopedAccessList = new AccessList({
            expansions: {
                test: [
                    'test2',
                ],
            },
            grants: [
                { permission: 'test', event: '2024', team: 'crew' },
                { permission: 'test', event: '2024', team: 'stewards' },
                { permission: 'test', event: '2025', team: 'stewards' },

                { permission: 'test2', event: '2025', team: 'hosts' },
            ],
        });

        expect(scopedAccessList.query('test')).not.toBeUndefined();
        expect(scopedAccessList.query('test')).toEqual({
            expanded: false,
            global: false,
        });

        expect(scopedAccessList.query('test', { event: '2020' })).toBeUndefined();
        expect(scopedAccessList.query('test', { event: '2030' })).toBeUndefined();

        expect(scopedAccessList.query('test', { event: '2024' })).not.toBeUndefined();
        expect(scopedAccessList.query('test', { event: '2024' })).toEqual({
            expanded: false,
            global: false,
            scope: {
                event: '2024',
                team: 'crew',  // not verified, so any value is accepted
            }
        });

        expect(scopedAccessList.query('test', { event: '2024', team: kAnyTeam }))
            .not.toBeUndefined();
        expect(scopedAccessList.query('test', { event: '2024', team: kAnyTeam })).toEqual({
            expanded: false,
            global: false,
            scope: {
                event: '2024',
                team: 'crew',  // verified against a wildcard
            }
        });

        expect(scopedAccessList.query('test', { team: 'staff' })).toBeUndefined();

        expect(scopedAccessList.query('test', { team: 'crew' })).not.toBeUndefined();
        expect(scopedAccessList.query('test', { team: 'crew' })).toEqual({
            expanded: false,
            global: false,
            scope: {
                event: '2024',  // not verified, so any value is accepted
                team: 'crew',
            },
        });

        expect(scopedAccessList.query('test', { event: kAnyEvent, team: 'crew' }))
            .not.toBeUndefined();
        expect(scopedAccessList.query('test', { event: kAnyEvent, team: 'crew' })).toEqual({
            expanded: false,
            global: false,
            scope: {
                event: '2024',  // verified against a wildcard
                team: 'crew',
            },
        });

        expect(scopedAccessList.query('test', { event: '2020', team: 'crew' })).toBeUndefined();
        expect(scopedAccessList.query('test', { event: '2024', team: 'staff' })).toBeUndefined();

        expect(scopedAccessList.query('test', { event: '2024', team: 'crew' })).not.toBeUndefined();
        expect(scopedAccessList.query('test', { event: '2024', team: 'crew' })).toEqual({
            expanded: false,
            global: false,
            scope: {
                event: '2024',
                team: 'crew',
            },
        });

        expect(scopedAccessList.query('test2', { event: '2024', team: 'crew' }))
            .not.toBeUndefined();
        expect(scopedAccessList.query('test2', { event: '2024', team: 'hosts' }))
            .toBeUndefined();
        expect(scopedAccessList.query('test2', { event: '2024', team: 'stewards' }))
            .not.toBeUndefined();

        expect(scopedAccessList.query('test2', { event: '2025', team: 'crew' }))
            .toBeUndefined();
        expect(scopedAccessList.query('test2', { event: '2025', team: 'hosts' }))
            .not.toBeUndefined();
        expect(scopedAccessList.query('test2', { event: '2025', team: 'stewards' }))
            .not.toBeUndefined();

        expect(scopedAccessList.query('test2', { event: '2025', team: 'stewards' })).toEqual({
            expanded: false,
            global: false,
            scope: {
                event: '2025',
                team: 'stewards',
            },
        });
    });

    it('should support global access to particular events', () => {
        const accessList = new AccessList({
            grants: [
                { permission: 'test', event: '2024' },
                { permission: 'test2' },
            ],
            events: '2025',
        });

        expect(accessList.query('test')).not.toBeUndefined();
        expect(accessList.query('test')).toEqual({
            expanded: false,
            global: false,
        });

        expect(accessList.query('test', { event: '2024' })).not.toBeUndefined();
        expect(accessList.query('test', { event: '2024' })).toEqual({
            expanded: false,
            global: false,
            scope: {
                event: '2024',
            },
        });

        expect(accessList.query('test', { event: '2025' })).not.toBeUndefined();
        expect(accessList.query('test', { event: '2025' })).toEqual({
            expanded: false,
            global: false,
            scope: 'global',
        });

        expect(accessList.query('test', { event: '2026' })).toBeUndefined();

        expect(accessList.query('test2', { event: '2025' })).not.toBeUndefined();
        expect(accessList.query('test2', { event: '2025' })).toEqual({
            expanded: false,
            global: true,
            scope: 'global',
        });
    });

    it('should support global access to particular teams', () => {
        const accessList = new AccessList({
            grants: [
                { permission: 'test', team: 'crew' },
                { permission: 'test2' },
            ],
            teams: 'hosts,stewards',
        });

        expect(accessList.query('test')).not.toBeUndefined();
        expect(accessList.query('test')).toEqual({
            expanded: false,
            global: false,
        });

        expect(accessList.query('test', { team: 'crew' })).not.toBeUndefined();
        expect(accessList.query('test', { team: 'crew' })).toEqual({
            expanded: false,
            global: false,
            scope: {
                team: 'crew',
            },
        });

        expect(accessList.query('test', { team: 'hosts' })).not.toBeUndefined();
        expect(accessList.query('test', { team: 'hosts' })).toEqual({
            expanded: false,
            global: false,
            scope: 'global',
        });

        expect(accessList.query('test', { team: 'stewards' })).not.toBeUndefined();
        expect(accessList.query('test', { team: 'stewards' })).toEqual({
            expanded: false,
            global: false,
            scope: 'global',
        });

        expect(accessList.query('test', { team: 'staff' })).toBeUndefined();

        expect(accessList.query('test2', { team: 'hosts' })).not.toBeUndefined();
        expect(accessList.query('test2', { team: 'hosts' })).toEqual({
            expanded: false,
            global: true,
            scope: 'global',
        });
    });

    it('should support global event and team access wildcards', () => {
        const accessList = new AccessList({
            grants: [
                'test',
                { permission: 'test2', event: '2024' },
                { permission: 'test3', event: '2025', team: 'crew' },
            ],
            events: kAnyEvent,
            teams: kAnyTeam,
        });

        expect(accessList.query('test')).not.toBeUndefined();
        expect(accessList.query('test', { event: '2024' })).not.toBeUndefined();
        expect(accessList.query('test', { team: 'staff' })).not.toBeUndefined();
        expect(accessList.query('test', { event: '2024', team: 'staff' })).not.toBeUndefined();

        expect(accessList.query('test2')).not.toBeUndefined();
        expect(accessList.query('test2', { event: '2024' })).not.toBeUndefined();
        expect(accessList.query('test2', { team: 'staff' })).not.toBeUndefined();
        expect(accessList.query('test2', { event: '2025', team: 'staff' })).not.toBeUndefined();

        expect(accessList.query('test3')).not.toBeUndefined();
        expect(accessList.query('test3', { event: '2025' })).not.toBeUndefined();
        expect(accessList.query('test3', { team: 'staff' })).not.toBeUndefined();
        expect(accessList.query('test3', { event: '2024', team: 'staff' })).not.toBeUndefined();
    });

    it('should have the ability to require a specific scope', () => {
        // This tests a feature that ignores `kAnyEvent` and `kAnyTeam` values in scoped queries,
        // which is behaviour that revocations specific to a particular event depend on without
        // invalidating results for other events.

        const regularAccessList = new AccessList({
            grants: {
                permission: 'test',
                event: '2024',
            },
        });

        expect(regularAccessList.query('test')).not.toBeUndefined();
        expect(regularAccessList.query('test', { event: kAnyEvent })).not.toBeUndefined();  // <--
        expect(regularAccessList.query('test', { event: '2024' })).not.toBeUndefined();
        expect(regularAccessList.query('test', { event: '2025' })).toBeUndefined();

        const requiredScopeAccessList = new AccessList({
            grants: {
                permission: 'test',
                event: '2024',
            },
            requireSpecificScope: true,
        });

        expect(requiredScopeAccessList.query('test')).not.toBeUndefined();
        expect(requiredScopeAccessList.query('test', { event: kAnyEvent })).toBeUndefined();  // <--
        expect(requiredScopeAccessList.query('test', { event: '2024' })).not.toBeUndefined();
        expect(requiredScopeAccessList.query('test', { event: '2025' })).toBeUndefined();
    });

    it('should be able to reflect the events and teams access is granted for', () => {
        const defaultAccessList = new AccessList();
        expect(defaultAccessList.events).toHaveLength(0);
        expect(defaultAccessList.teams).toHaveLength(0);

        const specificAccessList = new AccessList({
            events: '2024,2025',
            teams: 'crew,hosts',
        });

        expect(specificAccessList.events).toEqual([ '2024', '2025' ]);
        expect(specificAccessList.events).not.toEqual([ '2023', kAnyEvent ]);
        expect(specificAccessList.teams).toEqual([ 'crew', 'hosts' ]);
        expect(specificAccessList.teams).not.toEqual([ 'stewards', kAnyTeam ]);

        const allAccessList = new AccessList({
            events: '*',
            teams: '*',
        });

        expect(allAccessList.events).toEqual([ kAnyEvent ]);
        expect(allAccessList.teams).toEqual([ kAnyTeam ]);
    });
});
