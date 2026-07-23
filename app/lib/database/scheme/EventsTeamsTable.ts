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

export class EventsTeamsTable extends Table<DBConnection, 'EventsTeamsTable'> {
    eventId = this.column('event_id', 'int');
    teamId = this.column('team_id', 'int');
    teamTargetSize = this.column('team_target_size', 'int');
    teamMaximumSize = this.optionalColumnWithDefaultValue('team_maximum_size', 'int');
    enableTeam = this.columnWithDefaultValue('enable_team', 'int');
    //enableApplicationsStart = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('enable_applications_start', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    //enableApplicationsEnd = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('enable_applications_end', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    //enableRegistrationStart = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('enable_registration_start', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    //enableRegistrationEnd = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('enable_registration_end', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    //enableScheduleStart = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('enable_schedule_start', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    //enableScheduleEnd = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('enable_schedule_end', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    whatsappLink = this.optionalColumnWithDefaultValue('whatsapp_link', 'string');

    constructor() {
        super('events_teams');
    }
}

export const tEventsTeams = new EventsTeamsTable();

