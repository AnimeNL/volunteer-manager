// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import type { AccessControl } from '@lib/auth/access';
import type { EventState } from '@lib/event';
import type { ShiftColleagues, VolunteerAccessShift } from './SharedShiftIndex';
import { SharedShiftIndex } from './SharedShiftIndex';

export type { ShiftColleagues } from './SharedShiftIndex';

/**
 * Enabled team participating in the event.
 */
interface VolunteerAccessTeam {
    id: number;
    slug: string;
}

/**
 * Accepted volunteer participation in an event team.
 */
interface VolunteerAccessParticipation {
    userId: number;
    teamId: number;
    isLeader: boolean;
}

/**
 * Input snapshot required to construct a `VolunteerAccess` policy for a single viewer and event.
 */
export interface VolunteerAccessParams {
    /**
     * Signed-in viewer's user ID.
     */
    viewerUserId: number;

    /**
     * Unique slug of the event being evaluated, used for scoped `AccessControl` checks.
     */
    eventSlug: string;

    /**
     * Permission evaluator for the signed-in viewer.
     */
    access: AccessControl;

    /**
     * Teams enabled for this event (`events_teams.enable_team = 1`, non-deleted).
     */
    teams: readonly VolunteerAccessTeam[];

    /**
     * Directional standing team visibility edges (`teamId -> visibleTeamIds`) configured under
     * `/admin/organisation/structure/`. Non-transitive: only direct 1-hop edges are applied.
     */
    teamVisibility: ReadonlyMap<number, ReadonlySet<number>>;

    /**
     * Accepted participations (`users_events`) for this event.
     */
    participations: readonly VolunteerAccessParticipation[];

    /**
     * Active scheduled shift instances (`schedule` joined with `shifts`) for this event.
     */
    shifts: readonly VolunteerAccessShift[];
}

/**
 * Capability decision returned for a visible target volunteer.
 */
export type VolunteerAccessResult =
    | {
        level: 'shared-shift';
        isSelf: false;
        canEditAvatar: boolean;
        canViewPhoneNumber: boolean;
      }
    | {
        level: 'full';
        isSelf: boolean;
        visibleTeamIds: ReadonlySet<number>;
        canEditAvatar: boolean;
        canViewPhoneNumber: boolean;
        readableNoteTeamIds: ReadonlySet<number>;
        editableNoteTeamIds: ReadonlySet<number>;
      };

/**
 * Deciding unit for volunteer, team, and shift visibility in the schedule portal.
 *
 * Constructed from a shared event snapshot and the signed-in viewer's identity/permissions, this
 * class precomputes visibility indexes in O(N) so all directory, roster, profile, event, handoff,
 * search, and Server Action checks evaluate synchronously and consistently.
 */
export class VolunteerAccess {
    #viewerUserId: number;
    #eventSlug: string;
    #access: AccessControl;
    #canManageAvatars: boolean;

    #teamSlugById = new Map<number, string>();
    #teamIdBySlug = new Map<string, number>();

    #memberTeams = new Set<number>();
    #visibleTeams = new Set<number>();

    #participationsByUser = new Map<number, VolunteerAccessParticipation[]>();
    #sharedShifts: SharedShiftIndex;

    /**
     * Constructs an empty, fail-closed `VolunteerAccess` policy when event operational state is
     * unavailable.
     */
    static empty(
        eventSlug: string, viewerUserId: number, access: AccessControl): VolunteerAccess
    {
        return new VolunteerAccess({
            viewerUserId,
            eventSlug,
            access,
            teams: [],
            teamVisibility: new Map(),
            participations: [],
            shifts: [],
        });
    }

    /**
     * Constructs a `VolunteerAccess` policy directly from an in-memory `EventState` snapshot,
     * issuing no database queries.
     */
    static fromEventState(
        eventState: EventState, viewerUserId: number, access: AccessControl): VolunteerAccess
    {
        const teams = eventState.volunteers.getTeams().map(team => ({
            id: team.id,
            slug: team.slug,
        }));

        const participations: VolunteerAccessParticipation[] = [];
        for (const volunteer of eventState.volunteers.getVolunteers()) {
            for (const participation of volunteer.participations) {
                const role = eventState.volunteers.getRole(participation.roleId);
                participations.push({
                    userId: volunteer.id,
                    teamId: participation.teamId,
                    isLeader: role?.isLeader ?? false,
                });
            }
        }

        const shifts = eventState.shifts.getAllAssignments().map(assignment => ({
            scheduleId: assignment.id,
            userId: assignment.userId,
            shiftId: assignment.shiftId,
            shiftTeamId: assignment.teamId,
            activityId: assignment.activityId,
            startMs: assignment.startMs,
            endMs: assignment.endMs,
        }));

        return new VolunteerAccess({
            viewerUserId,
            eventSlug: eventState.eventSlug,
            access,
            teams,
            teamVisibility: eventState.volunteers.getTeamVisibility(),
            participations,
            shifts,
        });
    }

    constructor(params: VolunteerAccessParams) {
        this.#viewerUserId = params.viewerUserId;
        this.#eventSlug = params.eventSlug;
        this.#access = params.access;
        this.#canManageAvatars = params.access.can('organisation.avatars');

        for (const team of params.teams) {
            this.#teamSlugById.set(team.id, team.slug);
            this.#teamIdBySlug.set(team.slug, team.id);
        }

        for (const participation of params.participations) {
            if (!this.#teamSlugById.has(participation.teamId))
                continue;  // ignore participations in disabled or deleted teams

            let entries = this.#participationsByUser.get(participation.userId);
            if (!entries) {
                entries = [];
                this.#participationsByUser.set(participation.userId, entries);
            }

            entries.push(participation);

            if (participation.userId === this.#viewerUserId)
                this.#memberTeams.add(participation.teamId);
        }

        this.#computeVisibleTeams(params.teams, params.teamVisibility);
        this.#sharedShifts = new SharedShiftIndex(
            this.#viewerUserId, params.shifts, this.#participationsByUser);
    }

    /**
     * Enabled event team IDs in which the signed-in viewer has an accepted registration.
     */
    get memberTeams(): ReadonlySet<number> {
        return this.#memberTeams;
    }

    /**
     * Enabled event team IDs visible to the signed-in viewer in the directory and search.
     */
    get visibleTeams(): ReadonlySet<number> {
        return this.#visibleTeams;
    }

    /**
     * Returns whether the signed-in viewer is an accepted member of `team` (ID or slug).
     */
    isMemberTeam(team: number | string): boolean {
        const teamId = this.#resolveTeamId(team);
        return teamId !== undefined && this.#memberTeams.has(teamId);
    }

    /**
     * Returns whether `team` (ID or slug) is visible to the signed-in viewer in directory views.
     */
    canSeeTeam(team: number | string): boolean {
        const teamId = this.#resolveTeamId(team);
        return teamId !== undefined && this.#visibleTeams.has(teamId);
    }

    /**
     * Resolves `team` (ID or slug) to its numeric team ID, throwing `notFound()` if it does not
     * exist in the event or is not visible to the signed-in viewer.
     */
    requireTeam(team: number | string): number {
        const teamId = this.#resolveTeamId(team);
        if (teamId === undefined || !this.#visibleTeams.has(teamId))
            notFound();

        return teamId;
    }

    /**
     * Evaluates visibility and field-level permissions for `targetUserId`. Returns `undefined` when
     * the volunteer does not participate in an enabled team or is not visible to the viewer.
     */
    queryVolunteer(targetUserId: number): VolunteerAccessResult | undefined {
        const participations = this.#participationsByUser.get(targetUserId);
        if (!participations?.length)
            return undefined;

        const isSelf = targetUserId === this.#viewerUserId;
        const visibleTeamIds = new Set<number>();

        for (const participation of participations) {
            if (isSelf || this.#visibleTeams.has(participation.teamId))
                visibleTeamIds.add(participation.teamId);
        }

        if (visibleTeamIds.size > 0)
            return this.#buildFullAccessResult(isSelf, participations, visibleTeamIds);

        if (this.#sharedShifts.hasColleague(targetUserId)) {
            return {
                level: 'shared-shift',
                isSelf: false,
                canEditAvatar: this.#canManageAvatars,
                canViewPhoneNumber: participations.some(participation => participation.isLeader),
            };
        }

        return undefined;
    }

    /**
     * Evaluates access to `targetUserId`, throwing `notFound()` when the volunteer is invisible so
     * direct URLs cannot distinguish non-participants from hidden volunteers.
     */
    requireVolunteer(targetUserId: number): VolunteerAccessResult {
        const result = this.queryVolunteer(targetUserId);
        if (!result)
            notFound();

        return result;
    }

    /**
     * Returns whether the scheduled shift identified by `scheduleId` is visible to the viewer.
     */
    canSeeShift(scheduleId: number): boolean {
        const shift = this.#sharedShifts.getShift(scheduleId);
        if (!shift)
            return false;

        if (shift.userId === this.#viewerUserId)
            return true;

        if (this.#sharedShifts.isColleagueShift(scheduleId))
            return true;

        const participations = this.#participationsByUser.get(shift.userId);
        if (!participations?.some(participation => this.#visibleTeams.has(participation.teamId)))
            return false;

        if (this.#visibleTeams.has(shift.shiftTeamId))
            return true;

        // Hide shifts owned by a hidden team that the volunteer actually belongs to (multi-team
        // isolation), while preserving cross-team shifts onto which a volunteer was borrowed.
        return !participations.some(participation => participation.teamId === shift.shiftTeamId);
    }

    /**
     * Returns visible colleague schedule IDs (outgoing, overlapping, and incoming) for one of the
     * signed-in viewer's own shifts.
     */
    queryShiftColleagues(viewerScheduleId: number): ShiftColleagues {
        return this.#sharedShifts.getColleagues(viewerScheduleId);
    }

    #resolveTeamId(team: number | string): number | undefined {
        return typeof team === 'number'
            ? (this.#teamSlugById.has(team) ? team : undefined)
            : this.#teamIdBySlug.get(team);
    }

    #computeVisibleTeams(
        teams: readonly VolunteerAccessTeam[],
        teamVisibility: ReadonlyMap<number, ReadonlySet<number>>): void
    {
        for (const teamId of this.#memberTeams) {
            this.#visibleTeams.add(teamId);

            const targets = teamVisibility.get(teamId);
            if (!targets)
                continue;

            for (const targetTeamId of targets) {
                if (this.#teamSlugById.has(targetTeamId))
                    this.#visibleTeams.add(targetTeamId);
            }
        }

        // TODO: Align privileged team-level visibility consistently across the admin event menu and
        // the volunteer schedule portal.
        for (const team of teams) {
            if (this.#visibleTeams.has(team.id))
                continue;

            const scope = { event: this.#eventSlug, team: team.slug };
            if (this.#access.can('volunteers.participation', 'read', scope) ||
                this.#access.can('volunteers.schedules', 'read', scope))
            {
                this.#visibleTeams.add(team.id);
            }
        }
    }

    #buildFullAccessResult(
        isSelf: boolean,
        participations: readonly VolunteerAccessParticipation[],
        visibleTeamIds: ReadonlySet<number>): VolunteerAccessResult
    {
        const readableNoteTeamIds = new Set<number>();
        const editableNoteTeamIds = new Set<number>();
        let isVisibleLeader = false;

        for (const participation of participations) {
            if (!visibleTeamIds.has(participation.teamId))
                continue;

            if (participation.isLeader)
                isVisibleLeader = true;

            const teamSlug = this.#teamSlugById.get(participation.teamId)!;
            const scope = { event: this.#eventSlug, team: teamSlug };

            if (this.#access.can('volunteers.participation', 'read', scope))
                readableNoteTeamIds.add(participation.teamId);

            if (this.#access.can('volunteers.participation', 'update', scope))
                editableNoteTeamIds.add(participation.teamId);
        }

        return {
            level: 'full',
            isSelf,
            visibleTeamIds,
            canEditAvatar: isSelf || this.#canManageAvatars,
            canViewPhoneNumber: isSelf || isVisibleLeader || readableNoteTeamIds.size > 0,
            readableNoteTeamIds,
            editableNoteTeamIds,
        };
    }
}
