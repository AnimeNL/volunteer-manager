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
    RegistrationStatus,
} from "../Types";

export class UsersEventsTable extends Table<DBConnection, 'UsersEventsTable'> {
    userId = this.column('user_id', 'int');
    eventId = this.column('event_id', 'int');
    teamId = this.column('team_id', 'int');
    roleId = this.column('role_id', 'int');
    registrationDate = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('registration_date', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    registrationStatus = this.columnWithDefaultValue<RegistrationStatus>('registration_status', 'enum', 'RegistrationStatus');
    registrationOwnerId = this.optionalColumnWithDefaultValue('registration_owner_id', 'int');
    registrationNotes = this.optionalColumnWithDefaultValue('registration_notes', 'string');
    hotelEligible = this.optionalColumnWithDefaultValue('hotel_eligible', 'int');
    trainingEligible = this.optionalColumnWithDefaultValue('training_eligible', 'int');
    availabilityEventLimit = this.optionalColumnWithDefaultValue('availability_event_limit', 'int');

    constructor() {
        super('users_events');
    }
}

export const tUsersEvents = new UsersEventsTable();

