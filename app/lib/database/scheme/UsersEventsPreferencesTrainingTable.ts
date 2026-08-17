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

export class UsersEventsPreferencesTrainingTable extends Table<DBConnection, 'UsersEventsPreferencesTrainingTable'> {
    userId = this.column('user_id', 'int');
    eventId = this.column('event_id', 'int');
    preferenceVersion = this.column<Temporal.ZonedDateTime>('preference_version', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    preferenceVersionIsLatest = this.column('preference_version_is_latest', 'int');
    preferenceVersionUserId = this.column('preference_version_user_id', 'int');
    trainingId = this.column('training_id', 'int');

    constructor() {
        super('users_events_preferences_training');
    }
}

export const tUsersEventsPreferencesTraining = new UsersEventsPreferencesTrainingTable();

