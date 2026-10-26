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

export class RefundsTable extends Table<DBConnection, 'RefundsTable'> {
    userId = this.column('user_id', 'int');
    eventId = this.column('event_id', 'int');
    refundConfirmed = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('refund_confirmed', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    refundConfirmedBy = this.optionalColumnWithDefaultValue('refund_confirmed_by', 'int');

    constructor() {
        super('refunds');
    }
}

export const tRefunds = new RefundsTable();

