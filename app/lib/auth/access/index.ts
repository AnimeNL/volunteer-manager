// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

export type { AccessDescriptor, AccessOperation, AccessRestriction } from './AccessDescriptor';
export type { AccessResult } from './AccessControl';
export type { AccessScope, Grant } from './AccessList';
export type { BooleanPermission, CRUDPermission } from './Access';
export type { PermissionAccessCheck, PermissionSet } from './PermissionCheck';

export { AccessControl } from './AccessControl';
export { and, checkPermission, or } from './PermissionCheck';

export { kAnyEvent, kAnyTeam } from './AccessList';
export { kPermissions } from './Access';
