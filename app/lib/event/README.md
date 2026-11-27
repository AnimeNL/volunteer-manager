# Event State Library (`@lib/event`)

The Event State library maintains a permanent, time-agnostic, permission-neutral in-memory
representation of an event's operational state: its program (areas, locations, activities, and
timeslots), teams and roles, participating volunteers (including availability preferences and
exceptions), shifts, and scheduled shift assignments.

It powers fast synchronous lookups—both point-in-time (`state.at(time)`) and lateral ("John is on
Entrance at 14:50; what is he doing next?")—without repeatedly querying the database across
requests or baking a single user's permissions or clock offset into the cache.

## Architecture

Each event is cached permanently in `@lib/cache` under the `EventState` descriptor. Internally, the
state is split into five independent data slices that mirror the database's natural write
boundaries:

| Slice | Backing tables |
|---|---|
| `program` | `activities`, `activities_areas`, `activities_locations`, `activities_timeslots` |
| `teams` | `events_teams`, `teams`, `roles` |
| `volunteers` | `users_events`, `users`, `storage`, `users_events_preferences_availability` |
| `shifts` | `shifts`, `shifts_categories` |
| `schedule` | `schedule` |

### Slice Dependency Graph

```text
program ──────────────────────┐
                              ▼
teams ────────┬──────────► shifts ──────┐
              ▼                         ▼
         volunteers ───────────────► schedule ──► VolunteerTimeline
```

- **`program`** has no dependencies.
- **`teams`** has no dependencies.
- **`volunteers`** depends on `teams` (roles and team memberships).
- **`shifts`** depends on `program` and `teams` (resolving each shift's location and area from
  `shiftLocationId` or its linked `shiftActivityId`).
- **`schedule`** depends on `shifts` and `volunteers`.
- Each volunteer's compiled availability timeline depends on event boundary settings, that
  volunteer's preferences/exceptions, and that volunteer's scheduled assignments.

### Partial Invalidation

Because the cache is permanent, mutations invalidate only the affected slice(s) via
`invalidateEventState(event, scope)` (or `invalidateEventProgram(festivalId)` when only the AnPlan
festival ID is known):

1. Invalidation marks the requested slice(s) dirty lazily without issuing database queries.
2. On the next `getEventState()` call, only dirty slices are re-queried from the database, and
   concurrent requests share a single in-flight reload promise to prevent stampedes.
3. Only the facets affected by the reloaded slices are rebuilt in memory.
4. Omitting `scope` invalidates the entire event (for example when event dates or timezone change).

## Facets and Time-Bound Queries

`EventState` separates static topology from point-in-time evaluation:

- `state.program` (`ProgramIndex`) — areas, locations, activities, timeslots, and interval queries.
- `state.shifts` (`ShiftIndex`) — shifts, assignments, and handover/relief lookups.
- `state.volunteers` (`VolunteerIndex`) — teams, roles, volunteers, compiled timelines, and rosters.
- `state.at(time)` (`EventStateAtTime`) — lightweight view binding a single `Temporal.ZonedDateTime`
  or `Temporal.Instant` once per request for ergonomic point-in-time and lateral queries.

All intervals use half-open `[startMs, endMs)` semantics so back-to-back shifts or timeslots never
double-match at their shared boundary.

## Layered Volunteer Availability Model

A volunteer's timeline is compiled into a contiguous, non-overlapping sequence of segments by
applying five layers from lowest to highest precedence:

1. **Event boundary window** *(lowest precedence)*
   - Derived from `event.startTime` minus `schedule-event-view-start-hours` until `event.endTime`
     plus `schedule-event-view-end-hours`.
   - Outside this window the volunteer is `unavailable` (`reason: 'event-boundary'`); inside, the
     baseline is `available`.
2. **Volunteer's daily availability window**
   - Derived from `availabilityTimingStart` and `availabilityTimingEnd`, expanded per day in the
     event's timezone (handling overnight wrap-around such as `10:00`–`02:00` and DST transitions).
   - Outside the daily window the volunteer is `unavailable` (`reason: 'preference-window'`).
   - Optionally (`includePreferenceBuffer: true`), a 1-hour `avoid` buffer may be applied around
     window edges and prior to festival opening (used by registration availability previews).
3. **Requested program events** *(optional, off by default)*
   - Enabled via `includeRequestedEvents: true` (for registration previews and scheduling tools).
   - Downgrades `available` intervals overlapping the volunteer's selected `availabilityTimeslots`
     to `avoid` (`reason: 'requested-event'`), without upgrading `unavailable` intervals.
4. **Availability exceptions**
   - Explicit `available`, `avoid`, and `unavailable` entries from `availabilityExceptions`.
   - Overrides layers 1–3 via interval splitting: an `available` exception punches through both
     event boundaries and daily preference windows, while an `unavailable` exception carves out
     temporary absence within an otherwise available window.
5. **Scheduled shifts** *(highest precedence, optional)*
   - Active scheduled shifts (`tSchedule`) always take precedence over availability in live
     operational views so an actively working volunteer is never reported as unavailable.

### Live Status Mapping

In live operational views (such as the volunteer roster), segments map to three live statuses:

- `shift` → **`on-shift`** (distinguished further into backup vs. regular shift)
- `available` or `avoid` → **`available`** (off shift; `avoid` is informational for volunteers and
  scheduling leads, not an absence)
- `unavailable` → **`unavailable`**, with `availableAgainAtMs` pointing to the start of the next
  non-`unavailable` segment (or `undefined` when they are not expected to return during the event)
