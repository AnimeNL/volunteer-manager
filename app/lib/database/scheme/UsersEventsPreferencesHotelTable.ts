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

export class UsersEventsPreferencesHotelTable extends Table<DBConnection, 'UsersEventsPreferencesHotelTable'> {
    userId = this.column('user_id', 'int');
    eventId = this.column('event_id', 'int');
    preferenceVersion = this.column<Temporal.ZonedDateTime>('preference_version', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    preferenceVersionIsLatest = this.column('preference_version_is_latest', 'int');
    preferenceVersionUserId = this.column('preference_version_user_id', 'int');
    hotelInterested = this.column('hotel_interested', 'int');
    hotelRoomId = this.optionalColumnWithDefaultValue('hotel_room_id', 'int');
    hotelRoomOccupants = this.optionalColumnWithDefaultValue('hotel_room_occupants', 'int');
    hotelRoomPreferences = this.optionalColumnWithDefaultValue('hotel_room_preferences', 'string');
    hotelCheckIn = this.optionalColumnWithDefaultValue<Temporal.PlainDate>('hotel_check_in', 'customLocalDate', 'date', TemporalTypeAdapter);
    hotelCheckOut = this.optionalColumnWithDefaultValue<Temporal.PlainDate>('hotel_check_out', 'customLocalDate', 'date', TemporalTypeAdapter);

    constructor() {
        super('users_events_preferences_hotel');
    }
}

export const tUsersEventsPreferencesHotel = new UsersEventsPreferencesHotelTable();

