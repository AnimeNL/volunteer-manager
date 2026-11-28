// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { AvailabilityTimelineOptions, RequestedProgramTimeslot } from './AvailabilityTimeline';
import type { EventRole, EventTeam, EventVolunteer, EventVolunteerAvailability,
    EventVolunteerParticipation, VolunteerLiveStatus, VolunteerStateAtTime } from './Types';
import type { ProgramIndex } from './ProgramIndex';
import type { ShiftIndex } from './ShiftIndex';
import { AvailabilityTimeline } from './AvailabilityTimeline';

/**
 * Raw teams and roles slice loaded from `tEventsTeams`, `tTeams`, and `tRoles`.
 */
export interface TeamsSlice {
    readonly teams: readonly EventTeam[];
    readonly roles: readonly EventRole[];
    readonly teamVisibility?: ReadonlyMap<number, ReadonlySet<number>>;
}

/**
 * Raw volunteer record loaded from `tUsersEvents`, `tUsers`, `tStorage`, and
 * `tUsersEventsPreferencesAvailability`.
 */
export interface RawVolunteerRecord {
    readonly id: number;
    readonly name: string;
    readonly firstName: string;
    readonly displayName?: string;
    readonly avatar?: string;
    readonly phoneNumber?: string;
    readonly participations: readonly EventVolunteerParticipation[];
    readonly availability: EventVolunteerAvailability;
}

/**
 * Raw volunteers slice passed to `VolunteerIndex`.
 */
export interface VolunteersSlice {
    readonly volunteers: readonly RawVolunteerRecord[];
}

/**
 * Event temporal bounds required for compiling volunteer availability timelines.
 */
export interface VolunteerTimelineContext {
    readonly startTime: Temporal.ZonedDateTime;
    readonly endTime: Temporal.ZonedDateTime;
    readonly timeZone: string;
    readonly boundaryHours: {
        readonly beforeStart: number;
        readonly afterEnd: number;
    };
}

/**
 * Optional filter criteria for volunteer list and roster queries.
 */
export interface VolunteerFilter {
    readonly teamId?: number;
    readonly teamIds?: ReadonlySet<number>;
    readonly leadersOnly?: boolean;
    readonly status?: VolunteerLiveStatus;
}

/**
 * Immutable index of an event's teams, roles, volunteers, and pre-compiled availability timelines,
 * optimised for O(log S) point-in-time and O(1) lateral lookups.
 */
export class VolunteerIndex {
    readonly #context: VolunteerTimelineContext;
    readonly #program: ProgramIndex;
    readonly #shifts: ShiftIndex;

    readonly #teamsById = new Map<number, EventTeam>();
    readonly #teamsBySlug = new Map<string, EventTeam>();
    readonly #allTeamsSorted: readonly EventTeam[];
    readonly #teamVisibility: ReadonlyMap<number, ReadonlySet<number>>;
    readonly #rolesById = new Map<number, EventRole>();

    readonly #volunteersById = new Map<number, EventVolunteer>();
    readonly #allVolunteersSorted: readonly EventVolunteer[];
    readonly #volunteersByTeam = new Map<number, readonly EventVolunteer[]>();
    readonly #timelinesByUser = new Map<number, AvailabilityTimeline>();

    constructor(
        teamsSlice: TeamsSlice,
        volunteersSlice: VolunteersSlice,
        context: VolunteerTimelineContext,
        program: ProgramIndex,
        shifts: ShiftIndex)
    {
        this.#context = context;
        this.#program = program;
        this.#shifts = shifts;

        for (const role of teamsSlice.roles)
            this.#rolesById.set(role.id, role);

        const sortedTeams = [ ...teamsSlice.teams ]
            .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
        for (const team of sortedTeams) {
            this.#teamsById.set(team.id, team);
            this.#teamsBySlug.set(team.slug, team);
        }
        this.#allTeamsSorted = sortedTeams;
        this.#teamVisibility = teamsSlice.teamVisibility ?? new Map();

        const volunteersByTeam = new Map<number, EventVolunteer[]>();
        const allVolunteers: EventVolunteer[] = [];

        for (const raw of volunteersSlice.volunteers) {
            const isLeader = raw.participations.some(
                participation => this.#rolesById.get(participation.roleId)?.isLeader ?? false);

            const volunteer: EventVolunteer = {
                id: raw.id,
                name: raw.name,
                firstName: raw.firstName,
                displayName: raw.displayName,
                avatar: raw.avatar,
                phoneNumber: raw.phoneNumber,
                isLeader,
                participations: raw.participations,
                availability: raw.availability,
            };

            this.#volunteersById.set(volunteer.id, volunteer);
            allVolunteers.push(volunteer);

            for (const participation of volunteer.participations) {
                const existing = volunteersByTeam.get(participation.teamId);
                if (existing)
                    existing.push(volunteer);
                else
                    volunteersByTeam.set(participation.teamId, [ volunteer ]);
            }

            const timeline = new AvailabilityTimeline({
                event: {
                    startTime: context.startTime,
                    endTime: context.endTime,
                    timeZone: context.timeZone,
                },
                boundaryHours: context.boundaryHours,
                availability: {
                    preferenceTimingStart: volunteer.availability.preferenceTimingStart,
                    preferenceTimingEnd: volunteer.availability.preferenceTimingEnd,
                    exceptions: volunteer.availability.exceptions,
                },
                assignments: shifts.getAssignmentsForVolunteer(volunteer.id),
            });

            this.#timelinesByUser.set(volunteer.id, timeline);
        }

        allVolunteers.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
        this.#allVolunteersSorted = allVolunteers;

        for (const [ teamId, list ] of volunteersByTeam) {
            list.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
            this.#volunteersByTeam.set(teamId, list);
        }
    }

    getTeam(idOrSlug: number | string): EventTeam | undefined {
        return typeof idOrSlug === 'number'
            ? this.#teamsById.get(idOrSlug)
            : this.#teamsBySlug.get(idOrSlug);
    }

    getTeams(): readonly EventTeam[] {
        return this.#allTeamsSorted;
    }

    getTeamVisibility(): ReadonlyMap<number, ReadonlySet<number>> {
        return this.#teamVisibility;
    }

    getRole(roleId: number): EventRole | undefined {
        return this.#rolesById.get(roleId);
    }

    getVolunteer(userId: number): EventVolunteer | undefined {
        return this.#volunteersById.get(userId);
    }

    /**
     * Returns the role assigned to `userId` in `teamId`, if they participate in that team.
     */
    getVolunteerRole(userId: number, teamId: number): EventRole | undefined {
        const volunteer = this.#volunteersById.get(userId);
        const participation = volunteer?.participations.find(entry => entry.teamId === teamId);
        return participation ? this.#rolesById.get(participation.roleId) : undefined;
    }

    getVolunteers(filter?: Omit<VolunteerFilter, 'status'>): readonly EventVolunteer[] {
        let base = filter?.teamId !== undefined
            ? (this.#volunteersByTeam.get(filter.teamId) ?? [])
            : this.#allVolunteersSorted;

        if (filter?.teamIds) {
            const allowed = filter.teamIds;
            base = base.filter(volunteer =>
                volunteer.participations.some(entry => allowed.has(entry.teamId)));
        }

        if (filter?.leadersOnly)
            base = base.filter(volunteer => volunteer.isLeader);

        return base;
    }

    /**
     * Returns the compiled availability timeline for `userId`. Uses the pre-compiled cached
     * timeline when called with default options, or compiles on-demand when optional layers
     * (such as `includeRequestedEvents`) are enabled.
     */
    getTimeline(
        userId: number, options?: AvailabilityTimelineOptions): AvailabilityTimeline
    {
        const isDefault = !options || (
            !options.includeRequestedEvents &&
            !options.includePreferenceBuffer &&
            options.includeShifts !== false
        );

        if (isDefault)
            return this.#timelinesByUser.get(userId) ?? AvailabilityTimeline.empty();

        const volunteer = this.#volunteersById.get(userId);
        if (!volunteer)
            return AvailabilityTimeline.empty();

        const requestedTimeslots: RequestedProgramTimeslot[] = [];
        if (options.includeRequestedEvents) {
            for (const timeslotId of volunteer.availability.requestedTimeslotIds) {
                const timeslot = this.#program.getTimeslot(timeslotId);
                if (timeslot) {
                    requestedTimeslots.push({
                        id: timeslot.id,
                        activityId: timeslot.activityId,
                        startMs: timeslot.startMs,
                        endMs: timeslot.endMs,
                    });
                }
            }
        }

        return new AvailabilityTimeline({
            event: {
                startTime: this.#context.startTime,
                endTime: this.#context.endTime,
                timeZone: this.#context.timeZone,
            },
            boundaryHours: this.#context.boundaryHours,
            availability: {
                preferenceTimingStart: volunteer.availability.preferenceTimingStart,
                preferenceTimingEnd: volunteer.availability.preferenceTimingEnd,
                exceptions: volunteer.availability.exceptions,
                requestedTimeslots,
            },
            assignments: this.#shifts.getAssignmentsForVolunteer(volunteer.id),
        }, options);
    }

    /**
     * Returns the point-in-time and lateral state of `userId` at `timeMs` in O(log S).
     */
    getVolunteerStateAt(userId: number, timeMs: number): VolunteerStateAtTime | undefined {
        const volunteer = this.#volunteersById.get(userId);
        if (!volunteer)
            return undefined;

        const timeline = this.#timelinesByUser.get(userId) ?? AvailabilityTimeline.empty();
        const { current, previous, next, availableAgainAtMs } = timeline.queryAt(timeMs);
        const nextShift = this.#shifts.getNextAssignmentForVolunteer(userId, timeMs);

        if (current?.kind === 'shift') {
            const activeAssignments = current.assignments;
            const activeShift = this.#shifts.getShift(activeAssignments[0].shiftId);
            const isBackup = activeAssignments.some(
                assignment => this.#shifts.getShift(assignment.shiftId)?.isBackup ?? false);

            return {
                volunteer,
                status: 'on-shift',
                activeAssignments,
                activeShift,
                isBackup,
                current,
                previous,
                next,
                nextShift,
            };
        }

        if (current && (current.kind === 'available' || current.kind === 'avoid')) {
            return {
                volunteer,
                status: 'available',
                activeAssignments: [],
                isBackup: false,
                current,
                previous,
                next,
                nextShift,
            };
        }

        return {
            volunteer,
            status: 'unavailable',
            activeAssignments: [],
            isBackup: false,
            current,
            previous,
            next,
            nextShift,
            availableAgainAtMs,
        };
    }

    /**
     * Returns point-in-time states for all volunteers matching `filter` at `timeMs`.
     */
    getVolunteersStateAt(timeMs: number, filter?: VolunteerFilter): VolunteerStateAtTime[] {
        const volunteers = this.getVolunteers(filter);
        const results: VolunteerStateAtTime[] = [];

        for (const volunteer of volunteers) {
            const state = this.getVolunteerStateAt(volunteer.id, timeMs);
            if (!state)
                continue;
            if (filter?.status && state.status !== filter.status)
                continue;

            results.push(state);
        }

        return results;
    }

    /**
     * Approximate heap footprint in bytes for cache diagnostics reporting.
     */
    estimateByteSize(): number {
        let timelineBytes = 0;
        for (const timeline of this.#timelinesByUser.values())
            timelineBytes += timeline.estimateByteSize();

        return (
            this.#teamsById.size * 256 +
            this.#rolesById.size * 96 +
            this.#volunteersById.size * 512 +
            timelineBytes
        );
    }
}
