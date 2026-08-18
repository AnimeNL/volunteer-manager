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

export class UsersEventsPreferencesRefundsTable extends Table<DBConnection, 'UsersEventsPreferencesRefundsTable'> {
    userId = this.column('user_id', 'int');
    eventId = this.column('event_id', 'int');
    preferenceVersion = this.column<Temporal.ZonedDateTime>('preference_version', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    preferenceVersionIsLatest = this.column('preference_version_is_latest', 'int');
    preferenceVersionUserId = this.column('preference_version_user_id', 'int');
    refundTicketNumber = this.optionalColumnWithDefaultValue('refund_ticket_number', 'string');
    refundAccountIban = this.column('refund_account_iban', 'string');
    refundAccountName = this.column('refund_account_name', 'string');

    constructor() {
        super('users_events_preferences_refunds');
    }
}

export const tUsersEventsPreferencesRefunds = new UsersEventsPreferencesRefundsTable();

