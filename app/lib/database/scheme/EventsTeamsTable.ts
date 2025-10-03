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
    ZonedDateTime,
} from "../../Temporal";

export class EventsTeamsTable extends Table<DBConnection, 'EventsTeamsTable'> {
    eventId = this.column('event_id', 'int');
    teamId = this.column('team_id', 'int');
    teamTargetSize = this.column('team_target_size', 'int');
    teamMaximumSize = this.optionalColumnWithDefaultValue('team_maximum_size', 'int');
    enableTeam = this.columnWithDefaultValue('enable_team', 'int');
    enableApplicationsStart = this.optionalColumnWithDefaultValue<ZonedDateTime>('enable_applications_start', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    enableApplicationsEnd = this.optionalColumnWithDefaultValue<ZonedDateTime>('enable_applications_end', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    enableRegistrationStart = this.optionalColumnWithDefaultValue<ZonedDateTime>('enable_registration_start', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    enableRegistrationEnd = this.optionalColumnWithDefaultValue<ZonedDateTime>('enable_registration_end', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    enableScheduleStart = this.optionalColumnWithDefaultValue<ZonedDateTime>('enable_schedule_start', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    enableScheduleEnd = this.optionalColumnWithDefaultValue<ZonedDateTime>('enable_schedule_end', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    whatsappLink = this.optionalColumnWithDefaultValue('whatsapp_link', 'string');

    constructor() {
        super('events_teams');
    }
}

export const tEventsTeams = new EventsTeamsTable();

