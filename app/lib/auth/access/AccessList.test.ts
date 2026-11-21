// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { AccessList, kAnyEvent, kAnyTeam } from './AccessList';

describe('AccessList', () => {
    it('queries basic grants (single, comma-separated, array) and global scope fallback', () => {
        const single = new AccessList({ grants: 'foo.bar' });
        expect(single.query('foo')).toBeUndefined();
        expect(single.query('foo.bar')).toEqual({ expanded: false, global: true });
        expect(single.query('foo.bar', { event: '2024' }))
            .toEqual({ expanded: false, global: true, scope: 'global' });
        expect(single.query('foo.bar', { event: '2024', team: 'crew' }))
            .toEqual({ expanded: false, global: true, scope: 'global' });

        const comma = new AccessList({ grants: 'foo.bar, foo.baz , ' });
        const array = new AccessList({ grants: [ 'foo.bar', 'foo.baz' ] });
        expect(comma.query('foo.bar')).toEqual(array.query('foo.bar'));
        expect(comma.query('foo.baz')).toEqual(array.query('foo.baz'));
    });

    it('expands flat, nested, and circular permission groups safely', () => {
        const nested = new AccessList({
            expansions: {
                test: [ 'test.foo', 'test2' ],
                test2: [ 'test.bar', 'test3' ],
            },
            grants: 'test',
        });

        expect(nested.query('test')).toEqual({ expanded: false, global: true });
        for (const expanded of [ 'test.foo', 'test.bar', 'test2', 'test3' ])
            expect(nested.query(expanded)).toEqual({ expanded: true, global: true });
        expect(nested.query('test.qux')).toBeUndefined();

        const circular = new AccessList({
            expansions: { test: [ 'test.foo', 'test' ] },
            grants: 'test',
        });
        expect(circular.query('test')).toEqual({ expanded: false, global: true });
        expect(circular.query('test.foo')).toEqual({ expanded: true, global: true });
        expect(circular.query('test.bar')).toBeUndefined();
    });

    it('tracks global vs scoped grants even when combined with expansions', () => {
        const list = new AccessList({
            expansions: { test: [ 'test.foo' ] },
            grants: [
                { permission: 'test,test.qux', event: '2024' },
                { permission: 'test,test.bar' },
            ],
        });

        expect(list.query('test')).toEqual({ expanded: false, global: true });
        expect(list.query('test', { event: '2026', team: 'hosts' }))
            .toEqual({ expanded: false, global: true, scope: 'global' });
        expect(list.query('test.foo')).toEqual({ expanded: true, global: true });
        expect(list.query('test.foo', { event: '2026' }))
            .toEqual({ expanded: true, global: true, scope: 'global' });
        expect(list.query('test.bar')).toEqual({ expanded: false, global: true });
        expect(list.query('test.qux')).toEqual({ expanded: false, global: false });
        expect(list.query('test.qux', { event: '2026' })).toBeUndefined();

        // Global grant registered before a scoped grant retains global access:
        const globalFirst = new AccessList({
            grants: [ 'test', { permission: 'test', event: '2024', team: 'crew' } ],
        });
        expect(globalFirst.query('test', { event: '2026', team: 'hosts' }))
            .toEqual({ expanded: false, global: true, scope: 'global' });
    });

    it('matches event, team, and event+team scoped grants and wildcards', () => {
        const list = new AccessList({
            expansions: { test: [ 'test2' ] },
            grants: [
                { permission: 'test', event: '2024', team: 'crew' },
                { permission: 'test', event: '2024', team: 'stewards' },
                { permission: 'test', event: '2025', team: 'stewards' },
                { permission: 'test2', event: '2025', team: 'hosts' },
            ],
        });

        expect(list.query('test')).toEqual({ expanded: false, global: false });
        expect(list.query('test', { event: '2020' })).toBeUndefined();
        expect(list.query('test', { team: 'staff' })).toBeUndefined();
        expect(list.query('test', { event: '2020', team: 'crew' })).toBeUndefined();
        expect(list.query('test', { event: '2024', team: 'staff' })).toBeUndefined();

        expect(list.query('test', { event: '2024' })).toEqual({
            expanded: false, global: false, scope: { event: '2024', team: 'crew' },
        });
        expect(list.query('test', { event: '2024', team: kAnyTeam })).toEqual({
            expanded: false, global: false, scope: { event: '2024', team: 'crew' },
        });
        expect(list.query('test', { event: kAnyEvent, team: 'crew' })).toEqual({
            expanded: false, global: false, scope: { event: '2024', team: 'crew' },
        });
        expect(list.query('test2', { event: '2025', team: 'stewards' })).toEqual({
            expanded: false, global: false, scope: { event: '2025', team: 'stewards' },
        });
        expect(list.query('test2', { event: '2025', team: 'hosts' })).toBeDefined();
        expect(list.query('test2', { event: '2025', team: 'crew' })).toBeUndefined();
        expect(list.query('test2', { event: '2024', team: 'hosts' })).toBeUndefined();
    });

    it('supports global event/team lists, wildcards, and events/teams accessors', () => {
        const empty = new AccessList();
        expect(empty.events).toEqual([]);
        expect(empty.teams).toEqual([]);

        const specific = new AccessList({
            grants: [
                { permission: 'test', event: '2024', team: 'crew' },
                { permission: 'test2' },
            ],
            events: '2025',
            teams: 'hosts,stewards',
        });

        expect(specific.events).toEqual([ '2025' ]);
        expect(specific.teams).toEqual([ 'hosts', 'stewards' ]);
        expect(specific.query('test', { event: '2024' }))
            .toEqual({ expanded: false, global: false, scope: { event: '2024', team: 'crew' } });
        expect(specific.query('test', { event: '2025' }))
            .toEqual({ expanded: false, global: false, scope: 'global' });
        expect(specific.query('test', { team: 'hosts' }))
            .toEqual({ expanded: false, global: false, scope: 'global' });
        expect(specific.query('test', { event: '2026' })).toBeUndefined();
        expect(specific.query('test', { team: 'staff' })).toBeUndefined();
        expect(specific.query('test2', { event: '2025', team: 'hosts' }))
            .toEqual({ expanded: false, global: true, scope: 'global' });

        const wildcard = new AccessList({
            grants: [ { permission: 'test', event: '2025', team: 'crew' } ],
            events: kAnyEvent,
            teams: kAnyTeam,
        });
        expect(wildcard.events).toEqual([ kAnyEvent ]);
        expect(wildcard.teams).toEqual([ kAnyTeam ]);
        expect(wildcard.query('test', { event: '2024', team: 'staff' })).toBeDefined();
    });

    it('ignores wildcard queries when requireSpecificScope is enabled (used for revokes)', () => {
        const regular = new AccessList({ grants: { permission: 'test', event: '2024' } });
        const specific = new AccessList({
            grants: { permission: 'test', event: '2024' },
            requireSpecificScope: true,
        });

        expect(regular.query('test', { event: kAnyEvent })).toBeDefined();
        expect(specific.query('test', { event: kAnyEvent })).toBeUndefined();

        expect(specific.query('test')).toBeDefined();
        expect(specific.query('test', { event: '2024' })).toBeDefined();
        expect(specific.query('test', { event: '2025' })).toBeUndefined();
    });
});
