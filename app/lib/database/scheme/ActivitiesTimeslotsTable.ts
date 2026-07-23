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
import {
    ActivityType,
} from "../Types";

export class ActivitiesTimeslotsTable extends Table<DBConnection, 'ActivitiesTimeslotsTable'> {
    activityId = this.column('activity_id', 'int');
    timeslotId = this.column('timeslot_id', 'int');
    timeslotType = this.column<ActivityType>('timeslot_type', 'enum', 'ActivityType');
    timeslotStartTime = this.column<Temporal.ZonedDateTime>('timeslot_start_time', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    timeslotEndTime = this.column<Temporal.ZonedDateTime>('timeslot_end_time', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    timeslotLocationId = this.column('timeslot_location_id', 'int');
    timeslotCreated = this.column<Temporal.ZonedDateTime>('timeslot_created', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    timeslotUpdated = this.column<Temporal.ZonedDateTime>('timeslot_updated', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    timeslotDeleted = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('timeslot_deleted', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);

    constructor() {
        super('activities_timeslots');
    }
}

export const tActivitiesTimeslots = new ActivitiesTimeslotsTable();

