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
    PlainDate,
    ZonedDateTime,
} from "../../Temporal";

export class EventsSalesTable extends Table<DBConnection, 'EventsSalesTable'> {
    eventId = this.column('event_id', 'int');
    eventSaleId = this.column('event_sale_id', 'int');
    eventSaleDate = this.column<PlainDate>('event_sale_date', 'customLocalDate', 'date', TemporalTypeAdapter);
    eventSaleCount = this.column('event_sale_count', 'int');
    eventSaleUpdated = this.column<ZonedDateTime>('event_sale_updated', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);

    constructor() {
        super('events_sales');
    }
}

export const tEventsSales = new EventsSalesTable();

