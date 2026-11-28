# Volunteer Access (`app/schedule2/[event]/lib/access`)

This module is the single deciding unit governing volunteer, team, and shift visibility in the
volunteer schedule portal. It separates event-wide cached data from per-viewer access decisions so
that directory views, team rosters, volunteer profiles, event pages, personal schedules, search,
and Server Actions all enforce the same rules.

## Problem Definition

Volunteers participate across many teams during an event. While segregating teams completely is a
sensible default, strict isolation breaks down in two recurring operational scenarios:

1. **Standing cross-team collaboration**: Some teams consistently work together (for example, Crew
   Care supporting Crew) and need ongoing visibility into each other's rosters without granting
   broad administrative permissions across the entire festival.
2. **Ad-hoc cross-team shifts and handoffs**: Some shifts combine volunteers from otherwise
   unrelated teams—either on the same shift definition or on different shifts attached to the same
   program activity—and volunteers finishing a shift need to know who is arriving immediately
   afterwards to take over their post.

Because the schedule portal loads data independently per route behind React Server Components and
Server Actions rather than shipping one monolithic client payload, every entry point must consult
one authoritative policy unit so rules cannot drift and direct URLs cannot bypass directory
filtering.

## Requirements

1. **Self-access**: A participating volunteer can always see themselves, all of their own shifts
   (regardless of which team owns the shift), and their own favourites, and can edit their own
   avatar.
2. **Own team(s)**: A volunteer has full standard visibility into every team in which they hold an
   accepted registration for the event. Multi-team memberships are preserved rather than collapsed.
3. **Privileged team access**: Elevated and non-participating staff gain visibility per team based
   on team-scoped permissions matching the admin event menu (`volunteers.participation:read` or
   `volunteers.schedules:read`), rather than a blanket event-wide override.
4. **Configurable standing team visibility**: A dedicated, directional, non-transitive team
   visibility configuration (managed under `/admin/organisation/structure/`) lets a team see
   designated collaborating teams without granting administrative access.
5. **Default isolation**: Unrelated teams remain invisible in the volunteer directory, team routes,
   and search.
6. **Shared-shift and handoff visibility**: Volunteers scheduled on the same shift (`shiftId`) or
   the same program activity (`activityId`) with overlapping or exact-touching times (e.g., an
   outgoing shift ending at 15:00 and an incoming shift starting at 15:00) can see each other in
   that shift context.
7. **Bounded exposure for shared shifts**: Out-of-team volunteers surfaced solely through a shared
   or handoff shift do not appear in the volunteer directory or search. Direct profile navigation
   renders a restricted profile (identity, team/role, and leader phone if applicable) without their
   full schedule, availability status, or notes.
8. **Sensitive fields remain separate from visibility**: Visibility of a volunteer does not imply
   access to private fields such as phone numbers or registration notes.
9. **Permission-bound fields**: Reading and editing registration notes and viewing non-leader phone
   numbers follow team-scoped `AccessControl` permissions (`volunteers.participation:read` and
   `volunteers.participation:update`), and managing another volunteer's avatar requires
   `organisation.avatars`.
10. **Leader contactability**: Phone numbers and WhatsApp links for team leaders
    (`rolePermissionGrant !== null`) are visible to anyone who can see that leader (including
    collaborating teams and shared shifts).
11. **Multi-team isolation**: When a volunteer participates in both a visible team and a hidden
    team, viewers see them only under the visible team and do not see shifts belonging to their
    hidden team (unless shared or handing off with the viewer). When a volunteer with no hidden
    team membership is borrowed onto a cross-team shift owned by another team (such as a shared
    briefing), that shift remains visible on their schedule.
12. **Single deciding unit and cache-friendly layering**: Shared event data lives in the permanent
    `@lib/event` (`EventState`) cache; per-viewer decisions are evaluated in one pure, unit-tested
    `VolunteerAccess` instance memoized per request via `React.cache`.

## Visibility & Access Model

### Team visibility

A viewer's `visibleTeams` set for an event is the union of:

* **`memberTeams`**: Enabled event teams in which the viewer has an accepted registration.
* **Standing visibility (1-hop, directional)**: For each team in `memberTeams`, every enabled event
  team listed in its configured visibility targets. Edges are non-transitive: `A -> B` and `B -> C`
  does not grant `A` visibility into `C`.
* **Privileged teams**: Enabled event teams for which the viewer holds
  `volunteers.participation:read` or `volunteers.schedules:read` scoped to `(event, team)`.

### Shared-shift and exact-touching handoffs

For each scheduled shift `s` assigned to the viewer, any other accepted volunteer's shift `t` is
matched when:

1. **Shared work context**: `t.shiftId === s.shiftId`, or both shifts reference the same non-null
   `activityId`. Internal shifts without an `activityId` match only by `shiftId`.
2. **Overlap or exact touching**: `t.startMs <= s.endMs && s.startMs <= t.endMs`.

Matched shifts are classified relative to `s` for handoff presentation:

* **`outgoing`**: `t` ends exactly as `s` starts (`t.endMs === s.startMs && t.startMs < s.startMs`).
* **`overlapping`**: `t` overlaps `s` in time (`t.startMs < s.endMs && s.startMs < t.endMs`),
  including degenerate zero-duration matches.
* **`incoming`**: `t` starts exactly as `s` ends (`t.startMs === s.endMs && t.endMs > s.endMs`).

### Volunteer visibility tiers

`VolunteerAccess.queryVolunteer(targetUserId)` resolves every target volunteer to one of three
states (`requireVolunteer()` throws Next.js `notFound()` when invisible so participation cannot be
enumerated):

| Tier | Condition | Directory & search | Profile (`/volunteers/[id]`) | Shifts (`canSeeShift`) |
|---|---|---|---|---|
| `undefined` (none) | Not accepted in any enabled team, or neither visible team nor shared shift | Hidden | `404 Not Found` | Hidden |
| `'shared-shift'` | No visible team overlap, but at least one matched shared/handoff shift | Hidden | Restricted (identity, team/role, leader phone only) | Only matched shared/handoff shift(s) |
| `'full'` | At least one accepted team in `visibleTeams` (includes self) | Visible under visible team(s) | Full (schedule, availability, team-scoped notes, phone per rules) | Visible-team shifts, borrowed cross-team shifts, and shared/handoff shifts |

### Field-level access

* **Phone number**: Visible for `isSelf`, when the viewer holds `volunteers.participation:read` for
  at least one of the target's visible teams, or when the target holds a leader role (in a visible
  team for `'full'`, or in any accepted team for `'shared-shift'`).
* **Registration notes**: `readableNoteTeamIds` and `editableNoteTeamIds` are computed per visible
  team of the target using `volunteers.participation:read` and `volunteers.participation:update`.
* **Avatar editing**: Permitted when `isSelf` or the viewer holds `organisation.avatars`.

## Design Tradeoffs

### Directional, non-transitive team visibility vs. symmetric groups
Directional edges (`team_id -> visible_team_id`) allow both symmetric partnerships (Crew and Crew
Care listing each other) and asymmetric support teams (a support team seeing all teams without
exposing its own internal roster everywhere). Keeping evaluation strictly 1-hop prevents
unintended transitive leaks through hub teams.

### Exact-touching handoffs vs. a tolerance window
Matching `t.startMs <= s.endMs && s.startMs <= t.endMs` with zero tolerance handles back-to-back
shift transitions (e.g., 12:00–15:00 to 15:00–18:00) symmetrically—both outgoing and incoming
volunteers see each other—without exposing unrelated shifts separated by breaks. If schedules
regularly include small transition gaps, a tolerance constant can be introduced in one place.

### Capability object vs. per-route functional guards
Exposing a synchronous `VolunteerAccess` capability object mirrors `AccessControl` in
`app/lib/auth/access/` (delegating shift-handoff indexing to an internal `SharedShiftIndex`,
analogous to `AccessList`): it keeps access logic completely decoupled from UI data projection,
owns its `EventState` projection via `VolunteerAccess.fromEventState()` and
`VolunteerAccess.empty()` while staying pure and trivial to unit-test without database mocks, and
uses a discriminated union (`'shared-shift' | 'full'`) so callers cannot accidentally access
schedule or note fields on a restricted profile.
