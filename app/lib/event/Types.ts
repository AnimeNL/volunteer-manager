// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ActivityType } from '@lib/database/Types';

/**
 * Time input accepted by `EventState` query methods. Converted immediately to epoch milliseconds
 * internally for zero-allocation interval lookups.
 */
export type EventTimeInput = Temporal.Instant | Temporal.ZonedDateTime;

/**
 * Half-open `[startMs, endMs)` time interval in epoch milliseconds.
 */
export interface TimeInterval {
    readonly startMs: number;
    readonly endMs: number;
}

// -------------------------------------------------------------------------------------------------
// Program entities (POD)
// -------------------------------------------------------------------------------------------------

/**
 * Area within the festival venue grouping one or more locations.
 */
export interface EventArea {
    readonly id: number;
    readonly name: string;
    readonly type: ActivityType;
    readonly locationIds: readonly number[];
}

/**
 * Physical or logical location within a festival area.
 */
export interface EventLocation {
    readonly id: number;
    readonly areaId: number;
    readonly name: string;
    readonly type: ActivityType;
}

/**
 * Activity defined in the festival program (either public `Program` or `Internal`).
 */
export interface EventActivity {
    readonly id: number;
    readonly title: string;
    readonly type: ActivityType;
    readonly visible: boolean;
    readonly locationIds: readonly number[];
    readonly timeslotIds: readonly number[];
}

/**
 * Scheduled timeslot for a festival activity at a specific location.
 */
export interface EventTimeslot extends TimeInterval {
    readonly id: number;
    readonly activityId: number;
    readonly locationId: number;
    readonly areaId: number;
}

// -------------------------------------------------------------------------------------------------
// Teams, roles & volunteers (POD)
// -------------------------------------------------------------------------------------------------

/**
 * Team participating in an event.
 */
export interface EventTeam {
    readonly id: number;
    readonly slug: string;
    readonly name: string;
    readonly title: string;
    readonly colourLight: string;
    readonly colourDark: string;
    readonly enableDutyBook: boolean;
    readonly enableScheduling: boolean;
}

/**
 * Volunteer role within a team.
 */
export interface EventRole {
    readonly id: number;
    readonly name: string;
    readonly order: number;
    readonly isLeader: boolean;
}

/**
 * Accepted participation record linking a volunteer to a team and role in an event.
 */
export interface EventVolunteerParticipation {
    readonly teamId: number;
    readonly roleId: number;
    readonly notes?: string;
}

/**
 * Parsed availability exception window in epoch milliseconds.
 */
export interface EventAvailabilityException extends TimeInterval {
    readonly state: 'available' | 'avoid' | 'unavailable';
}

/**
 * Availability preferences stored for a volunteer in an event (unique per volunteer per event).
 */
export interface EventVolunteerAvailability {
    readonly preferenceTimingStart?: number;
    readonly preferenceTimingEnd?: number;
    readonly exceptions: readonly EventAvailabilityException[];
    readonly requestedTimeslotIds: readonly number[];
}

/**
 * Volunteer accepted into one or more teams for an event.
 */
export interface EventVolunteer {
    readonly id: number;
    readonly name: string;
    readonly firstName: string;
    readonly displayName?: string;
    readonly avatar?: string;
    readonly phoneNumber?: string;
    readonly isLeader: boolean;
    readonly participations: readonly EventVolunteerParticipation[];
    readonly availability: EventVolunteerAvailability;
}

// -------------------------------------------------------------------------------------------------
// Shifts & scheduled assignments (POD)
// -------------------------------------------------------------------------------------------------

/**
 * Shift definition for a team during an event, with resolved location and area references.
 */
export interface EventShift {
    readonly id: number;
    readonly teamId: number;
    readonly categoryId: number;
    readonly categoryName: string;
    readonly countsContribution: boolean;
    readonly name: string;
    readonly description?: string;
    readonly colour?: string;
    readonly excitement: number;
    readonly activityId?: number;
    readonly locationId?: number;
    readonly areaId?: number;
    readonly isBackup: boolean;
}

/**
 * Single scheduled shift instance assigned to a volunteer.
 */
export interface EventShiftAssignment extends TimeInterval {
    readonly id: number;
    readonly shiftId: number;
    readonly userId: number;
    readonly teamId: number;
    readonly activityId?: number;
    readonly locationId?: number;
    readonly areaId?: number;
}

// -------------------------------------------------------------------------------------------------
// Compiled volunteer availability timeline & point-in-time results
// -------------------------------------------------------------------------------------------------

/**
 * Contiguous, non-overlapping segment on a volunteer's compiled availability timeline.
 */
export type AvailabilitySegment =
    | {
        readonly kind: 'shift';
        readonly startMs: number;
        readonly endMs: number;
        readonly assignments: readonly EventShiftAssignment[];
    }
    | {
        readonly kind: 'available';
        readonly startMs: number;
        readonly endMs: number;
        readonly explicit: boolean;
    }
    | {
        readonly kind: 'avoid';
        readonly startMs: number;
        readonly endMs: number;
        readonly reason: 'exception' | 'preference-buffer' | 'requested-event';
        readonly timeslotId?: number;
        readonly activityId?: number;
    }
    | {
        readonly kind: 'unavailable';
        readonly startMs: number;
        readonly endMs: number;
        readonly reason: 'event-boundary' | 'exception' | 'preference-window';
    };

/**
 * Operational live status of a volunteer at a specific instant.
 */
export type VolunteerLiveStatus = 'available' | 'on-shift' | 'unavailable';

/**
 * Point-in-time and lateral state of a volunteer at a queried instant.
 */
export interface VolunteerStateAtTime {
    readonly volunteer: EventVolunteer;
    readonly status: VolunteerLiveStatus;
    readonly activeAssignments: readonly EventShiftAssignment[];
    readonly activeShift?: EventShift;
    readonly isBackup: boolean;
    readonly current?: AvailabilitySegment;
    readonly previous?: AvailabilitySegment;
    readonly next?: AvailabilitySegment;
    readonly nextShift?: EventShiftAssignment;
    readonly availableAgainAtMs?: number;
}

/**
 * Shift-level handover snapshot at a queried instant: active assignments plus immediate preceding
 * and following assignments on the same shift.
 */
export interface ShiftStateAtTime {
    readonly shift: EventShift;
    readonly active: readonly EventShiftAssignment[];
    readonly previous: readonly EventShiftAssignment[];
    readonly next: readonly EventShiftAssignment[];
}

// -------------------------------------------------------------------------------------------------
// Partial invalidation
// -------------------------------------------------------------------------------------------------

/**
 * Independently reloadable data slice within a cached `EventState`.
 */
export type EventStateSlice = 'program' | 'schedule' | 'shifts' | 'teams' | 'volunteers';

/**
 * Granular scope accepted by `invalidateEventState()`. Passing `undefined` invalidates the
 * entire event entry.
 */
export type EventStateInvalidationScope =
    | EventStateSlice
    | readonly EventStateSlice[]
    | { readonly volunteer: number };
