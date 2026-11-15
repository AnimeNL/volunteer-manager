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

export class WeeztixOrdersTable extends Table<DBConnection, 'WeeztixOrdersTable'> {
    weeztixGuid = this.column('weeztix_guid', 'string');
    weeztixOrderEvent = this.column('weeztix_order_event', 'string');
    weeztixOrderName = this.column('weeztix_order_name', 'string');
    weeztixOrderCreated = this.column<Temporal.ZonedDateTime>('weeztix_order_created', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    weeztixOrderUpdated = this.column<Temporal.ZonedDateTime>('weeztix_order_updated', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    weeztixOrderDeleted = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('weeztix_order_deleted', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);

    constructor() {
        super('weeztix_orders');
    }
}

export const tWeeztixOrders = new WeeztixOrdersTable();

