// @ts-nocheck
// biome-ignore-all lint/style/useImportType: not feasible
/**
 * DO NOT EDIT:
 *
 * This file has been auto-generated from database schema using ts-sql-codegen.
 * Any changes will be overwritten.
 */
import { Table } from "ts-sql-query/Table";
import type { DBConnection } from "../Connection";
import {
    TemporalTypeAdapter,
} from "../TemporalTypeAdapter";

export class UsersEventsPreferencesAvailabilityTable extends Table<DBConnection, 'UsersEventsPreferencesAvailabilityTable'> {
    userId = this.column('user_id', 'int');
    eventId = this.column('event_id', 'int');
    teamId = this.column('team_id', 'int');
    preferenceVersion = this.column<Temporal.ZonedDateTime>('preference_version', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    preferenceVersionIsLatest = this.column('preference_version_is_latest', 'int');
    preferenceVersionUserId = this.column('preference_version_user_id', 'int');
    availabilityBuildUpTearDown = this.optionalColumnWithDefaultValue('availability_build_up_tear_down', 'string');
    availabilityExceptions = this.optionalColumnWithDefaultValue('availability_exceptions', 'string');
    availabilityFullyAvailable = this.column('availability_fully_available', 'int');
    availabilityHours = this.column('availability_hours', 'int');
    availabilityTimeslots = this.optionalColumnWithDefaultValue('availability_timeslots', 'string');
    availabilityTimingStart = this.column('availability_timing_start', 'int');
    availabilityTimingEnd = this.column('availability_timing_end', 'int');
    availabilityRemarks = this.optionalColumnWithDefaultValue('availability_remarks', 'string');

    constructor() {
        super('users_events_preferences_availability');
    }
}

export const tUsersEventsPreferencesAvailability = new UsersEventsPreferencesAvailabilityTable();

