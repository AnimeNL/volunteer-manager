// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Permission groups that will be expanded prior to being applied. For example, when a user has been
 * granted the "admin" permission, permissions included in the associated list will also be granted.
 */
export const kPermissionGroups: Record<string, string[]> = {
    root: [
        'root',  // reflection (restricted)
        'admin',  // reflection

        'event',
        'organisation',
        'statistics',
        'system',
        'volunteers',
    ],

    admin: [
        'admin',  // reflection

        'event.applications:create',
        'event.applications:read',
        'event.applications:update',
        'event.duty-book:delete',
        'event.duty-book:read',
        'event.duty-book:update',
        'event.help-requests',
        'event.hotels',
        'event.knowledge',
        // note: event.refunds omitted
        'event.requests',
        'event.retention:read',
        'event.retention:update',
        'event.schedule.access',
        'event.schedule.planning:read',
        'event.schedule.planning:update',
        'event.settings',
        'event.shift-categories',
        'event.shifts:create',
        'event.shifts:delete',
        'event.shifts:read',
        'event.shifts:update',
        'event.tickets:read',
        'event.trainings',
        'event.vendors:read',
        'event.vendors:update',
        'event.visible',
        'event.volunteers.information:read',
        'event.volunteers.information:update',
        'event.volunteers.overrides',
        'event.volunteers.participation',

        'organisation.accounts:create',
        // note: organisation.accounts:delete omitted
        'organisation.accounts:read',
        'organisation.accounts:update',
        'organisation.avatars',
        'organisation.displays',
        'organisation.environments',
        'organisation.exports',
        'organisation.feedback',
        // note: organisation.impersonation omitted
        'organisation.nardo',
        'organisation.permissions:read',
        'organisation.permissions:update',
        'orrganisation.roles',
        // note: organisation.silent omitted
        'organisation.teams',

        'statistics.basic',
        // note: statistics.finances omitted

        'system.content',
        // note: system.internals omitted
        // note: system.internals.ai omitted
        'system.internals.outbox',
        'system.internals.scheduler',
        // note: system.internals.settings omitted
        // note: system.logs:delete omitted
        'system.logs:read',
        'system.subscriptions.eligible',
        'system.subscriptions.management',

        'volunteers.tickets:create',
        'volunteers.tickets:delete',
        'volunteers.tickets:read',
        'volunteers.tickets:update',
    ],

    staff: [
        'event.applications:create',
        'event.applications:read',
        'event.applications:update',
        'event.duty-book:delete',
        'event.duty-book:read',
        'event.duty-book:update',
        'event.help-requests',
        'event.hotels',
        'event.knowledge',
        // note: event.refunds omitted
        'event.requests',
        'event.retention:read',
        'event.retention:update',
        'event.schedule.access',
        'event.schedule.planning:read',
        'event.schedule.planning:update',
        'event.settings',
        // note: event.shift-categories omitted
        'event.shifts:create',
        'event.shifts:delete',
        'event.shifts:read',
        'event.shifts:update',
        // note: event.tickets:read omitted
        'event.trainings',
        'event.vendors:read',
        'event.vendors:update',
        'event.visible',
        'event.volunteers.information:read',
        'event.volunteers.information:update',
        'event.volunteers.overrides',
        'event.volunteers.participation',

        // note: organisation.accounts:create omitted
        // note: organisation.accounts:delete omitted
        'organisation.accounts:read',
        // note: organisation.accounts:update omitted
        'organisation.avatars',
        'organisation.displays',
        // note: organisation.environments omitted
        'organisation.exports',
        'organisation.feedback',
        // note: organisation.impersonation omitted
        'organisation.nardo',
        // note: organisation.permissions:read omitted
        // note: organisation.permissions:update omitted
        // note: organisation.roles omitted
        // note: organisation.silent omitted
        // note: organisation.teams omitted

        'statistics.basic',
        // note: statistics.finances omitted

        'system.content',
        // note: system.internals omitted
        // note; system.internals.ai omitted
        // note: system.internals.outbox omitted
        // note: system.internals.scheduler omitted
        // note: system.internals.settings omitted
        // note: system.logs:delete omitted
        'system.logs:read',
        'system.subscriptions.eligible',
        // note: system.subscriptions.management omitted

        // note: volunteers.tickets:create omitted
        // note: volunteers.tickets:delete omitted
        'volunteers.tickets:read',
        'volunteers.tickets:update',
    ],

    senior: [
        // note: event.applications:create omitted
        'event.applications:read',
        'event.applications:update',
        // note: event.duty-book:delete omitted
        'event.duty-book:read',
        'event.duty-book:update',
        'event.help-requests',
        // note: event.hotels omitted
        'event.knowledge',
        // note: event.refunds omitted
        // note: event.requests omitted
        'event.retention:read',
        'event.retention:update',
        'event.schedule.access',
        'event.schedule.planning:read',
        'event.schedule.planning:update',
        // note: event.settings omitted
        // note: event.shift-categories omitted
        // note: event.shifts:create omitted
        // note: event.shifts:delete omitted
        'event.shifts:read',
        'event.shifts:update',
        // note: event.tickets:read omitted
        // note: event.trainings omitted
        'event.vendors:read',
        // note: event.vendors:update omitted
        'event.visible',
        'event.volunteers.information:read',
        // note: event.volunteers.information:update omitted
        // note: event.volunteers.overrides omitted
        'event.volunteers.participation',

        // note: organisation.accounts:create omitted
        // note: organisation.accounts:delete omitted
        // note: organisation.accounts:read omitted
        // note: organisation.accounts:update omitted
        'organisation.avatars',
        // note: organisation.displays omitted
        // note: organisation.environments omitted
        // note: organisation.exports omitted
        // note: organisation.feedback omitted
        // note: organisation.impersonation omitted
        // note: organisation.nardo omitted
        // note: organisation.permissions:read omitted
        // note: organisation.permissions:update omitted
        // note: organisation.roles omitted
        // note: organisation.silent omitted
        // note: organisation.teams omitted

        'statistics.basic',
        // note: statistics.finances omitted

        // note: system.content omitted
        // note: system.internals omitted
        // note; system.internals.ai omitted
        // note: system.internals.outbox omitted
        // note: system.internals.scheduler omitted
        // note: system.internals.settings omitted
        // note: system.logs:delete omitted
        // note: system.logs:read omitted
        'system.subscriptions.eligible',
        // note: system.subscriptions.management omitted

        // note: volunteers.tickets:create omitted
        // note: volunteers.tickets:delete omitted
        'volunteers.tickets:read',
        // note: volunteers.tickets:update omitted
    ],

    testgroup: [ 'test' ],  // for testing purposes only
};
