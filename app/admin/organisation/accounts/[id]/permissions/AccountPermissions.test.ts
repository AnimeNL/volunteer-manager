// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { AccessControl } from '@lib/auth/AccessControl';
import { toPermissionList } from './toPermissionList';

describe('toPermissionList', () => {
    const adminAccess = new AccessControl({ grants: [ 'admin' ] });
    const emptyAccess = new AccessControl({ /* no grants */ });
    const rootAccess = new AccessControl({ grants: [ 'root' ] });

    it('should reject invalid input', () => {
        expect(() => toPermissionList(null, rootAccess, emptyAccess)).toThrow();
        expect(() => toPermissionList([ 'foo.bar' ], rootAccess, emptyAccess)).toThrow();
        expect(() => toPermissionList('foo.bar', rootAccess, emptyAccess)).toThrow();
    });

    it('should be able to translate boolean-based permissions to a list', () => {
        expect(toPermissionList({ admin: true }, rootAccess, emptyAccess)).toBe('admin');
        expect(toPermissionList({ event: { visible: true } }, rootAccess, emptyAccess))
            .toBe('event.visible');
        expect(toPermissionList({ event: { visible: false } }, rootAccess, emptyAccess))
            .toBe(null);
        expect(toPermissionList({
            event: { applications: true, visible: true }
        }, rootAccess, emptyAccess)).toBe('event.applications,event.visible');
        expect(toPermissionList({
            event: { visible: true }, test: { boolean: true }
        }, rootAccess, emptyAccess)).toBe('event.visible,test.boolean');
        expect(toPermissionList({
            event: { visible: false }, test: { boolean: false }
        }, rootAccess, emptyAccess)).toBe(null);
    });

    it('should be able to translate CRUD-based permissions to a list', () => {
        expect(toPermissionList({
            event: { applications: { read: false } }
        }, rootAccess, emptyAccess)).toBe(null);
        expect(toPermissionList({
            event: { applications: { read: true } }
        }, rootAccess, emptyAccess)).toBe('event.applications:read');
        expect(toPermissionList({
            event: { applications: { read: true, update: true } }
        }, rootAccess, emptyAccess)).toBe('event.applications:read,event.applications:update');
        expect(toPermissionList({
            event: { applications: { create: true, read: false, update: false, delete: true } }
        }, rootAccess, emptyAccess)).toBe('event.applications:create,event.applications:delete');
        expect(toPermissionList({
            event: { applications: { create: true, read: true, update: true, delete: true } }
        }, rootAccess, emptyAccess)).toBe('event.applications');
        expect(toPermissionList({
            event: { applications: { create: false, read: false, update: false, delete: false } }
        }, rootAccess, emptyAccess)).toBe(null);
    });

    it('should verify that permission restrictions are adhered to', () => {
        const impersonationAccess = new AccessControl({
            grants: [ 'organisation.impersonation' ],
        });

        expect(toPermissionList({ organisation: { impersonation: true } }, rootAccess, emptyAccess))
            .toBe('organisation.impersonation');
        expect(toPermissionList({
            organisation: { impersonation: true }
        }, rootAccess, impersonationAccess)).toBe('organisation.impersonation');  // already granted
        expect(() =>
            toPermissionList({ organisation: { impersonation: true } }, adminAccess, emptyAccess))
                .toThrow();

        const deleteLogsAccess = new AccessControl({
            grants: [ 'system.logs:delete' ],
        });

        expect(toPermissionList({ system: { logs: { delete: true } } }, rootAccess, emptyAccess))
            .toBe('system.logs:delete');
        expect(toPermissionList({ system: { logs: { read: true } } }, rootAccess, emptyAccess))
            .toBe('system.logs:read');
        expect(toPermissionList({
            system: { logs: { delete: true } }
        }, adminAccess, deleteLogsAccess)).toBe('system.logs:delete');  // already granted
        expect(() =>
            toPermissionList({ system: { logs: { delete: true } } }, adminAccess, emptyAccess))
                .toThrow();

        expect(toPermissionList({ system: { logs: true } }, rootAccess, emptyAccess))
            .toBe('system.logs');
        expect(toPermissionList({ system: { logs: true } }, adminAccess, deleteLogsAccess))
            .toBe('system.logs');  // the restricted permission has already been granted
        expect(() => toPermissionList({ system: { logs: true } }, adminAccess, emptyAccess))
            .toThrow();
    });
});
