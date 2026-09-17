// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { AccessDescriptor } from './AccessDescriptor';

/**
 * List of permissions available in the Volunteer Manager. Keep grouped based on namespace, then
 * alphabetized based on the individual permission names.
 */
export const kPermissions = {
    // ---------------------------------------------------------------------------------------------
    // Administrator permission
    // ---------------------------------------------------------------------------------------------

    'root': {
        type: 'boolean',
        restrict: 'root',
    },

    'admin': {
        type: 'boolean',
    },

    // ---------------------------------------------------------------------------------------------
    // Event-associated permissions
    // ---------------------------------------------------------------------------------------------

    'event.applications': {
        type: 'crud',
        requireEvent: true,
        requireTeam: true,
    },

    'event.duty-book': {
        type: 'crud',
        requireEvent: true,
        requireTeam: true,
    },

    'event.help-requests': {
        type: 'boolean',
        requireEvent: true,
    },

    'event.hotels': {
        type: 'boolean',
        requireEvent: true,
    },

    'event.knowledge': {
        type: 'boolean',
        requireEvent: true,
    },

    'event.requests': {
        type: 'boolean',
        requireEvent: true,
    },

    'event.schedule.access': {
        type: 'boolean',
        requireEvent: true,
    },

    'event.schedule.planning': {
        type: 'crud',
        requireEvent: true,
        requireTeam: true,
    },

    'event.settings': {
        type: 'boolean',
        requireEvent: true,
    },

    'event.shift-categories': {
        type: 'boolean',
    },

    'event.shifts': {
        type: 'crud',
        requireEvent: true,
        requireTeam: true,
    },

    'event.refunds': {
        type: 'boolean',
        requireEvent: true,
    },

    'event.retention': {
        type: 'crud',
        requireEvent: true,
        requireTeam: true,
    },

    'event.tickets': {
        type: 'crud',
        requireEvent: true,
    },

    'event.trainings': {
        type: 'boolean',
        requireEvent: true,
    },

    'event.vendors': {
        type: 'crud',
        requireEvent: true,
        requireTeam: true,
    },

    'event.visible': {
        type: 'boolean',
        requireEvent: true,
    },

    'event.volunteers.information': {
        type: 'crud',
        requireEvent: true,
        requireTeam: true,
    },

    'event.volunteers.overrides': {
        type: 'boolean',
        requireEvent: true,
        requireTeam: true,
    },

    'event.volunteers.participation': {
        type: 'boolean',
        requireEvent: true,
    },

    // ---------------------------------------------------------------------------------------------
    // Organisation-associated permissions
    // ---------------------------------------------------------------------------------------------

    'organisation.accounts': {
        type: 'crud',
    },

    'organisation.avatars': {
        type: 'boolean',
    },

    'organisation.displays': {
        type: 'boolean',
    },

    'organisation.environments': {
        type: 'crud',
    },

    'organisation.exports': {
        type: 'boolean',
    },

    'organisation.feedback': {
        type: 'boolean',
    },

    'organisation.impersonation': {
        type: 'boolean',
        restrict: 'root',
    },

    'organisation.nardo': {
        type: 'boolean',
    },

    'organisation.roles': {
        type: 'crud',
    },

    'organisation.silent': {
        type: 'boolean',
    },

    'organisation.teams': {
        type: 'crud',
    },

    // ---------------------------------------------------------------------------------------------
    // Statistics-associated permissions
    // ---------------------------------------------------------------------------------------------

    'statistics.basic': {
        type: 'boolean',
    },

    'statistics.finances': {
        type: 'boolean',
    },

    // ---------------------------------------------------------------------------------------------
    // System-associated permissions
    // ---------------------------------------------------------------------------------------------

    'system.content': {
        type: 'boolean',
    },

    'system.integrations': {
        type: 'boolean',
    },

    'system.internals.ai': {
        type: 'boolean',
    },

    'system.internals.cache': {
        type: 'boolean',
    },

    'system.internals.debug': {
        type: 'boolean',
    },

    'system.internals.outbox': {
        type: 'boolean',
    },

    'system.internals.scheduler': {
        type: 'boolean',
    },

    'system.internals.settings': {
        type: 'boolean',
    },

    'system.logs': {
        type: 'crud',
        restrict: {
            delete: 'root',
        },
    },

    'system.permissions': {
        type: 'boolean',
    },

    'system.subscriptions.eligible': {
        type: 'boolean',
    },

    'system.subscriptions.management': {
        type: 'boolean',
    },

    // ---------------------------------------------------------------------------------------------
    // Volunteer-associated permissions
    // ---------------------------------------------------------------------------------------------

    'volunteers.tickets': {
        type: 'crud',
        requireEvent: true,
    },

    // ---------------------------------------------------------------------------------------------
    // Permissions that exist for testing purposes
    // ---------------------------------------------------------------------------------------------

    'test.boolean': {
        type: 'boolean',
    },

    'test.boolean.required.both': {
        type: 'boolean',
        requireEvent: true,
        requireTeam: true,
    },

    'test.boolean.required.event': {
        type: 'boolean',
        requireEvent: true,
    },

    'test.boolean.required.team': {
        type: 'boolean',
        requireTeam: true,
    },

    'test.crud': {
        type: 'crud',
    },

} satisfies Record<string, AccessDescriptor>;

// -------------------------------------------------------------------------------------------------

/**
 * Selects the permissions from `Source` whose type matches the given `Type`.
 */
type PermissionListForType<Source, Type> =
    { [K in keyof Source]: Source[K] extends { type: Type } ? K : never }[keyof Source];

/**
 * Type listing every permission known to the Volunteer Manager.
 */
export type Permission = keyof typeof kPermissions;

/**
 * Type listing every boolean permission known to the Volunteer Manager.
 */
export type BooleanPermission = PermissionListForType<typeof kPermissions, 'boolean'>;

/**
 * Type listing every CRUD permission known to the Volunteer Manager.
 */
export type CRUDPermission = PermissionListForType<typeof kPermissions, 'crud'>;
