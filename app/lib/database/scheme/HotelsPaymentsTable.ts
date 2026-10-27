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
    HotelPaymentResponsible,
} from "../Types";

export class HotelsPaymentsTable extends Table<DBConnection, 'HotelsPaymentsTable'> {
    eventId = this.column('event_id', 'int');
    paymentName = this.column('payment_name', 'string');
    paymentAmount = this.column('payment_amount', 'int');
    paymentResponsible = this.column<HotelPaymentResponsible>('payment_responsible', 'enum', 'HotelPaymentResponsible');
    paymentConfirmed = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('payment_confirmed', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);

    constructor() {
        super('hotels_payments');
    }
}

export const tHotelsPayments = new HotelsPaymentsTable();

