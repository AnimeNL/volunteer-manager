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
    ShirtFit,
    ShirtSize,
} from "../Types";

export class UsersEventsPreferencesParticipationTable extends Table<DBConnection, 'UsersEventsPreferencesParticipationTable'> {
    userId = this.column('user_id', 'int');
    eventId = this.column('event_id', 'int');
    preferenceVersion = this.column<Temporal.ZonedDateTime>('preference_version', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    preferenceVersionIsLatest = this.column('preference_version_is_latest', 'int');
    preferenceVersionUserId = this.column('preference_version_user_id', 'int');
    participationDietary = this.optionalColumnWithDefaultValue('participation_dietary', 'string');
    participationIncludeCreditReel = this.column('participation_include_credit_reel', 'int');
    participationIncludeSocialMedia = this.column('participation_include_social_media', 'int');
    participationTshirtFit = this.column<ShirtFit>('participation_tshirt_fit', 'enum', 'ShirtFit');
    participationTshirtSize = this.column<ShirtSize>('participation_tshirt_size', 'enum', 'ShirtSize');

    constructor() {
        super('users_events_preferences_participation');
    }
}

export const tUsersEventsPreferencesParticipation = new UsersEventsPreferencesParticipationTable();

