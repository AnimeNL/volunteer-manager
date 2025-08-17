// @ts-nocheck
/* eslint-disable quotes, max-len */
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
import {
    RegistrationStatus,
    ShirtFit,
    ShirtSize,
} from "../Types";

export class UsersEventsTable extends Table<DBConnection, 'UsersEventsTable'> {
    userId = this.column('user_id', 'int');
    eventId = this.column('event_id', 'int');
    teamId = this.column('team_id', 'int');
    roleId = this.column('role_id', 'int');
    registrationDate = this.optionalColumnWithDefaultValue<ZonedDateTime>('registration_date', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    registrationStatus = this.columnWithDefaultValue<RegistrationStatus>('registration_status', 'enum', 'RegistrationStatus');
    registrationNotes = this.optionalColumnWithDefaultValue('registration_notes', 'string');
    shirtFit = this.columnWithDefaultValue<ShirtFit>('shirt_fit', 'enum', 'ShirtFit');
    shirtSize = this.optionalColumnWithDefaultValue<ShirtSize>('shirt_size', 'enum', 'ShirtSize');
    hotelEligible = this.optionalColumnWithDefaultValue('hotel_eligible', 'int');
    trainingEligible = this.optionalColumnWithDefaultValue('training_eligible', 'int');
    availabilityBuildUpTearDown = this.optionalColumnWithDefaultValue('availability_build_up_tear_down', 'string');
    //availabilityBuildUp = this.optionalColumnWithDefaultValue('availability_build_up', 'string');
    //availabilityTearDown = this.optionalColumnWithDefaultValue('availability_tear_down', 'string');
    availabilityEventLimit = this.optionalColumnWithDefaultValue('availability_event_limit', 'int');
    availabilityExceptions = this.optionalColumnWithDefaultValue('availability_exceptions', 'string');
    availabilityTimeslots = this.optionalColumnWithDefaultValue('availability_timeslots', 'string');
    preferenceHours = this.optionalColumnWithDefaultValue('preference_hours', 'int');
    preferenceTimingStart = this.optionalColumnWithDefaultValue('preference_timing_start', 'int');
    preferenceTimingEnd = this.optionalColumnWithDefaultValue('preference_timing_end', 'int');
    preferences = this.optionalColumnWithDefaultValue('preferences', 'string');
    preferencesDietary = this.optionalColumnWithDefaultValue('preferences_dietary', 'string');
    preferencesUpdated = this.optionalColumnWithDefaultValue<ZonedDateTime>('preferences_updated', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    fullyAvailable = this.columnWithDefaultValue('fully_available', 'int');
    includeCredits = this.columnWithDefaultValue('include_credits', 'int');
    includeSocials = this.columnWithDefaultValue('include_socials', 'int');

    constructor() {
        super('users_events');
    }
}

export const tUsersEvents = new UsersEventsTable();

