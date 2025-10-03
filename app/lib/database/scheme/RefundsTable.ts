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

export class RefundsTable extends Table<DBConnection, 'RefundsTable'> {
    userId = this.column('user_id', 'int');
    eventId = this.column('event_id', 'int');
    refundTicketNumber = this.optionalColumnWithDefaultValue('refund_ticket_number', 'string');
    refundAccountIban = this.column('refund_account_iban', 'string');
    refundAccountName = this.column('refund_account_name', 'string');
    refundRequested = this.columnWithDefaultValue<ZonedDateTime>('refund_requested', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    refundConfirmed = this.optionalColumnWithDefaultValue<ZonedDateTime>('refund_confirmed', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);

    constructor() {
        super('refunds');
    }
}

export const tRefunds = new RefundsTable();

