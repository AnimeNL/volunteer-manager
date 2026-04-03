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
        name: 'Root administrator (role)',
        description:
            'The root administrator role grants all permissions in the system without exception, ' +
            'providing unrestricted access. This includes read/write access to system logs and ' +
            'the ability to update permissions for other people.',
        restrict: 'root',
        type: 'boolean',
        warning: true,
    },

    'admin': {
        name: 'Administrator (role)',
        description:
            'The administrator role grants all permissions in the system, except for the ability ' +
            'to remove log entries, to grant or revoke permissions to others, and access to ' +
            'internal tooling only useful for development.',
        type: 'boolean',
        warning: true,
    },

    // ---------------------------------------------------------------------------------------------
    // Event-associated permissions
    // ---------------------------------------------------------------------------------------------

    'event.applications': {
        name: 'Application management',
        description:
            'This permission determines whether the volunteer is able to deal with incoming ' +
            'participation applications.',
        hide: [ 'delete' ],  // applications must be responded to, even if done silently
        requireEvent: true,
        requireTeam: true,
        type: 'crud',
    },

    'event.duty-book': {
        name: 'Duty Book',
        description:
            'This permission controls whether they have the ability access the Duty Book, ' +
            'regardless of which team they are part of. Revoking this permission does not ' +
            'override the regular team-based access rules.',
        type: 'boolean',
    },

    'event.help-requests': {
        name: 'Help requests',
        description:
            'This permission controls whether they have the ability to see and respond to all ' +
            'incoming help requests from the Volunteering Displays. This ability shows up both ' +
            'in the administration area, and in the scheduling app.',
        requireEvent: true,
        type: 'boolean',
    },

    'event.hotels': {
        name: 'Hotel management',
        description:
            'This permission grants access to the hotel management tool for this particular ' +
            'event, in which hotel room availability can be changed and preferences can be ' +
            'tracked.',
        requireEvent: true,
        type: 'boolean',
    },

    'event.knowledge': {
        name: 'Knowledge base',
        description:
            'This permission describes whether they have unrestricted access to the knowledge ' +
            'base of this particular event, regardless of role and/or team restrictions.',
        requireEvent: true,
        type: 'boolean',
    },

    'event.requests': {
        name: 'Program request management',
        description:
            'This permission describes whether they have the ability to manage incoming program ' +
            'requests set in AnPlan. Doing so requires collaboration across the broader AnimeCon ' +
            'organisation.',
        requireEvent: true,
        type: 'boolean',
    },

    'event.schedule.access': {
        name: 'Event schedule access',
        description:
            'This permission decides whether the volunteer has the ability to access the portal ' +
            'for any particular events, without having to grant admin access or visibility.',
        requireEvent: true,
        type: 'boolean',
    },

    'event.schedule.planning': {
        name: 'Event schedule planning',
        description:
            'This permission decides whether they have the ability to read or update event ' +
            'scheduling, which is specific to a given event and team. The schedules are the ' +
            'rosters shared with volunteers, telling them when they have to be where, doing what.',
        hide: [ 'create', 'delete' ],  // schedules are either in read-only more, or fully mutable
        requireEvent: true,
        requireTeam: true,
        type: 'crud',
    },

    'event.settings': {
        name: 'Event settings',
        description:
            'This permission controls whether they have access to event settings, such as its ' +
            'name, deadlines and participating teams.',
        requireEvent: true,
        type: 'boolean',
    },

    'event.shift-categories': {
        name: 'Shift category settings',
        description:
            'This permission decides whether they have access to the shift category settings, ' +
            'which are shared across events. Messing up these settings could potentially affect ' +
            'mutability of past events in the scheduling app.',
        type: 'boolean',
        warning: true,
    },

    'event.shifts': {
        name: 'Event shift planning',
        description:
            'This permission decides whether they have the ability to see or manage the shifts ' +
            'that are planned for a particular event and team. The shifts decide what it is that ' +
            'we expect volunteers to do.',
        requireEvent: true,
        requireTeam: true,
        type: 'crud',
    },

    'event.refunds': {
        name: 'Refund management',
        description:
            'This permission grants them access to see and process refunds requested by the ' +
            'volunteers. This potentially includes personal information such as their bank ' +
            'account details, and should therefore be rarely granted.',
        requireEvent: true,
        type: 'boolean',
        warning: true,
    },

    'event.retention': {
        name: 'Retention management',
        description:
            'This permission grants them access to the ability to help out with retention ' +
            'management for a particular event and team. It can reveal contact information of ' +
            'people who helped us out in the past to them.',
        hide: [ 'create', 'delete' ],  // retention can only be read or updated
        requireEvent: true,
        requireTeam: true,
        type: 'crud',
    },

    'event.trainings': {
        name: 'Training management',
        description:
            'This permission grants access to the training management tool for this particular ' +
            'event, in which training availability and preferences can be tracked',
        requireEvent: true,
        type: 'boolean',
    },

    'event.vendors': {
        name: 'Vendor team schedules',
        description:
            'This permission determines whether the volunteer has the ability to manage vendor ' +
            'information part of the teams they have access to, for example the first aid and ' +
            'security teams.',
        hide: [ 'create', 'delete' ],  // schedules can only be read or updated
        requireEvent: true,
        requireTeam: true,
        type: 'crud',
    },

    'event.visible': {
        name: 'Event visibility',
        description:
            'The event visibility permission determined whether the volunteer is able to see the ' +
            'existence of a particular event, for example in the admin area.',
        requireEvent: true,
        type: 'boolean',
    },

    'event.volunteers.information': {
        name: 'Volunteer information',
        description:
            'This permission controls whether the volunteer is able to read or update the ' +
            'basic information associated with a participant in the event, for example their ' +
            'availability preferences',
        hide: [ 'create', 'delete' ],  // information can only be read or updated
        requireEvent: true,
        requireTeam: true,
        type: 'crud',
    },

    'event.volunteers.overrides': {
        name: 'Volunteer overrides',
        description:
            'This permission controls whether the volunteer is able to override the settings for ' +
            'a particular volunteer during a particular event. Examples of this include whether ' +
            'they are eligible to book a hotel room or participate in the training.',
        requireEvent: true,
        requireTeam: true,
        type: 'boolean',
    },

    'event.volunteers.participation': {
        name: 'Participation management',
        description:
            'This permission controls whether the volunteer is able to change the participation ' +
            'of other volunteers in an event, i.e. which team they participate in and what their ' +
            'role within that team is.',
        requireEvent: true,
        type: 'boolean',
    },

    // ---------------------------------------------------------------------------------------------
    // Organisation-associated permissions
    // ---------------------------------------------------------------------------------------------

    'organisation.accounts': {
        name: 'Account management',
        description:
            'This permission determines whether the volunteer has the ability to manage all ' +
            'known accounts, including their own. This is a dangerous permission, as access to ' +
            'PII is by necessity included in this.',
        type: 'crud',
    },

    'organisation.avatars': {
        name: 'Avatar management',
        description:
            'This permission controls whether they have the ability to manage avatars of other ' +
            'accounts, i.e. update new photos or delete existing ones.',
        type: 'boolean',
    },

    'organisation.displays': {
        name: 'Display management',
        description:
            'This permission determines whether the volunteer has the ability to manage the ' +
            'volunteering displays we distribute across the festival grounds. This includes ' +
            'access to help requests.',
        type: 'boolean',
    },

    'organisation.environments': {
        name: 'Environment management',
        description:
            'This permission determines whether the volunteer has the ability to manage the ' +
            'runtime environments that the Volunteer Manager can operate under. This is a ' +
            'dangerous permission as mistakes can render the system unusable.',
        type: 'boolean',
    },

    'organisation.exports': {
        name: 'Export volunteering data',
        description:
            'This description controls whether they have the ability to export portions of ' +
            'volunteering data for purposes of sharing this with a third party. All our data ' +
            'export mechanisms are GDPR compatible.',
        type: 'boolean',
        warning: true,
    },

    'organisation.feedback': {
        name: 'Feedback access',
        description:
            'Volunteers have the ability to submit feedback through the portals, as well as ' +
            'through the feedback sub-app. This permission controls whether they have access to ' +
            'read all the feedback, possibly attributed.',
        type: 'boolean',
    },

    'organisation.impersonation': {
        name: 'Impersonation',
        description:
            'This permission allows the volunteer to impersonate other accounts by signing in ' +
            'as them without needing their authentication information. Any modifications made ' +
            'while impersonating someone will be attributed to the other person!',
        restrict: 'root',
        type: 'boolean',
        warning: true,
    },

    'organisation.nardo': {
        name: 'Del a Rie Advies',
        description:
            'This permission controls whether they are able to access and manage the advice ' +
            'made available by Del a Rie advies.',
        type: 'boolean',
    },

    'organisation.permissions': {
        name: 'Permission management',
        description:
            'This permission determines whether the volunteer is able to manage the permissions ' +
            'of other accounts. This is an extremely dangerous permission, as it enables them ' +
            'to manage their own permissions as well.',
        hide: [ 'create', 'delete' ],  // all mutations are considered updates
        type: 'crud',
        warning: true,
    },

    'organisation.roles': {
        name: 'Role management',
        description:
            'This permission decides whether the volunteer is able to manage volunteering roles ' +
            'available during AnimeCon.',
        type: 'boolean',
    },

    'organisation.silent': {
        name: 'Silent mutations',
        description:
            'This permission controls whether they have the ability to make significant changes ' +
            'to someone\'s participation in an event without having to send them a message.',
        type: 'boolean',
        warning: true,
    },

    'organisation.teams': {
        name: 'Team management',
        description:
            'This permission decides whether they have access to settings regarding teams and ' +
            'roles that existing within the Volunteer Manager. This is considered a dangerous ' +
            'permission as this currently also contains environment configuration.',
        type: 'boolean',
        warning: true,
    },

    // ---------------------------------------------------------------------------------------------
    // Statistics-associated permissions
    // ---------------------------------------------------------------------------------------------

    'statistics.basic': {
        name: 'Basic statistics',
        description: 'This permission grants access to basic statistics across events and teams.',
        type: 'boolean',
    },

    'statistics.finances': {
        name: 'Financial statistics',
        description:
            'This permission determines whether they have access to financial statistics stored ' +
            'in the Volunteer Manager, such as sales reports for individual events.',
        type: 'boolean',
    },

    // ---------------------------------------------------------------------------------------------
    // System-associated permissions
    // ---------------------------------------------------------------------------------------------

    'system.content': {
        name: 'Global content access',
        description:
            'This permission controls whether they are able to access global content, which ' +
            'includes our privacy policy, e-mail messages, notifications and other content that ' +
            'is shared across events and teams.',
        type: 'boolean',
    },

    'system.internals': {
        name: 'Internal system capabilities',
        description:
            'This permission contains a set of individual permissions for features that will ' +
            'generally not be useful to regular volunteers, as they are part of internal system ' +
            'configuration or debugging capabilities.',
        type: 'boolean',
    },

    'system.internals.ai': {
        name: 'Generative AI-related tooling',
        description:
            'This permission controls whether the volunteer has access to Generative AI-related ' +
            'tooling, such as configuration and debugging pages. This does not include generated ' +
            'e-mail messages, which are granted based on feature availability.',
        type: 'boolean',
    },

    'system.internals.outbox': {
        name: 'System message outbox',
        description:
            'This permission controls whether the volunteer is able to see the messages that ' +
            'have left the Volunteer Manager, including volunteer activity, account activation ' +
            'and recovery messages, and so on.',
        type: 'boolean',
        warning: true,
    },

    'system.internals.scheduler': {
        name: 'System scheduler status',
        description:
            'The system scheduler is responsible for background operations such as sending ' +
            'messages and fetching program updates. This permission controls access to the ' +
            'status and overview pages of the scheduler.',
        type: 'boolean',
    },

    'system.internals.settings': {
        name: 'System settings',
        description:
            'This permission grants access to the Volunteer Manager settings that allow detailed ' +
            'behaviour of the system to be adjusted without needing code changes.',
        type: 'boolean',
    },

    'system.logs': {
        name: 'Volunteer Manager logs',
        description:
            'This permission determines whether the volunteer is able to access system logs. The ' +
            'logs contain all account activity, actions and changes that are made in the ' +
            'Volunteer Manager, without exception.',
        hide: [ 'create', 'update' ],  // logs generally should be read-only, but can be deleted
        restrict: {
            delete: 'root',
        },
        type: 'crud',
        warning: true,
    },

    'system.subscriptions.eligible': {
        name: 'Subscription eligibility',
        description:
            'This permission controls whether the volunteer is eligible to be subscribed to ' +
            'notifications from the Volunteer Manager, such as incoming applications and help ' +
            'requests.',
        type: 'boolean',
    },

    'system.subscriptions.management': {
        name: 'Subscription management',
        description:
            'This permission controls whether they are able to manage the notification ' +
            'subscriptions of all eligible users, not just of themselves, and decide who ' +
            'receives which notifications through which channels.',
        type: 'boolean',
        warning: true,
    },

    // ---------------------------------------------------------------------------------------------
    // Permissions that exist for testing purposes
    // ---------------------------------------------------------------------------------------------

    'test.boolean': {
        name: 'Test (boolean)',
        description: 'Boolean permission exclusively used for testing purposes',
        hide: true,  // rationale: testing-only permission
        type: 'boolean',
    },

    'test.boolean.required.both': {
        name: 'Test (boolean w/ event + team)',
        description: 'Boolean permission exclusively used for testing purposes w/ required scoping',
        hide: true,  // rationale: testing-only permission
        requireEvent: true,
        requireTeam: true,
        type: 'boolean',
    },

    'test.boolean.required.event': {
        name: 'Test (boolean w/ event)',
        description: 'Boolean permission exclusively used for testing purposes w/ required event',
        hide: true,  // rationale: testing-only permission
        requireEvent: true,
        type: 'boolean',
    },

    'test.boolean.required.team': {
        name: 'Test (boolean w/ team)',
        description: 'Boolean permission exclusively used for testing purposes w/ required team',
        hide: true,  // rationale: testing-only permission
        requireTeam: true,
        type: 'boolean',
    },

    'test.crud': {
        name: 'Test (CRUD)',
        description: 'CRUD permission exculsively used for testing purposes',
        hide: true,  // rationale: testing-only permission
        type: 'crud',
    },

} satisfies Record<string, AccessDescriptor>;

// -------------------------------------------------------------------------------------------------

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
        'volunteer',
    ],
    admin: [
        'admin',  // reflection

        'event',

        // note: organisation.accounts:create omitted
        'organisation.accounts:read',
        'organisation.accounts:update',
        // note: organisation.accounts:delete omitted
        'organisation.avatars',
        'organisation.displays',
        // note: organisation.environments omitted
        'organisation.exports',
        'organisation.feedback',
        // note: organisation.impersonation omitted
        'organisation.nardo',
        'organisation.permissions',
        'organisation.roles',
        'organisation.silent',
        'organisation.teams',

        'statistics.basic',
        // note: statistics.finances omitted

        'system.content',
        'system.internals.ai',
        'system.internals.outbox',
        'system.internals.scheduler',
        // note: system.internals.settings omitted
        // note: system.logs:delete omitted (restricted)
        'system.logs:read',
        'system.subscriptions',
    ],

    staff: [
        'event.applications',
        'event.duty-book',
        'event.help-requests',
        'event.hotels',
        'event.knowledge',
        // note: event.refunds omitted
        'event.requests',
        'event.retention',
        'event.schedule',
        'event.settings',
        // note: event.shift-categories omitted
        'event.shifts',
        'event.trainings',
        'event.vendors',
        'event.visible',
        'event.volunteers.information',
        'event.volunteers.overrides',
        'event.volunteers.participation',

        // note: organisation.accounts:create omitted
        'organisation.accounts:read',
        // note: organisation.accounts:update omitted
        // note: organisation.accounts:delete omitted
        'organisation.avatars',
        // note: organisation.displays omitted
        // note: organisation.environments omitted
        'organisation.exports',
        'organisation.feedback',
        // note: organisation.impersonation omitted (restricted)
        'organisation.nardo',
        // note: organisation.permissions omitted
        // note: organisation.roles omitted
        // note: organisation.silent omitted
        // note: organisation.teams omitted

        'statistics.basic',
        // note: statistics.finances omitted

        'system.subscriptions.eligible',
    ],

    senior: [
        // note: event.applications:create omitted
        'event.applications:read',
        // note: event.applications:update omitted
        // note: event.duty-book omitted
        // note: event.help-requests omitted
        // note: event.hotels omitted
        'event.knowledge',
        // note: event.refunds omitted
        // note: event.requests omitted
        'event.retention',
        'event.schedule.access',
        'event.schedule.planning:read',
        // note: event.schedule.planning:update omitted
        // note: event.settings omitted
        // note: event.shift-categories omitted
        // note: event.shifts:create omitted
        // note: event.shifts:delete omitted
        'event.shifts:read',
        // note: event.shifts:update omitted
        // note: event.trainings omitted
        // note: event.vendors:create omitted
        // note: event.vendors:delete omitted
        'event.vendors:read',
        // note: event.vendors:update omitted
        'event.visible',
        'event.volunteers.information',
        // note: event.volunteers.overrides omitted
        // note: event.volunteers.participation omitted

        // note: organisation.accounts omitted
        'organisation.avatars',
        // note: organisation.displays omitted
        // note: organisation.environments omitted
        // note: organisation.exports omitted
        // note: organisation.feedback omitted
        // note: organisation.impersonation omitted (restricted)
        // note: organisation.nardo omitted
        // note: organisation.permissions omitted
        // note: organisation.roles omitted
        // note: organisation.silent omitted
        // note: organisation.teams omitted

        'statistics.basic',
        // note: statistics.finances omitted

        'system.subscriptions.eligible',
    ],

    testgroup: [ 'test' ],  // for testing purposes only
};

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
