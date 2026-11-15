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

export class WeeztixPurchasesTable extends Table<DBConnection, 'WeeztixPurchasesTable'> {
    weeztixGuid = this.column('weeztix_guid', 'string');
    weeztixTicketGuid = this.optionalColumnWithDefaultValue('weeztix_ticket_guid', 'string');
    weeztixOrderGuid = this.column('weeztix_order_guid', 'string');
    weeztixEventGuid = this.column('weeztix_event_guid', 'string');
    weeztixPurchaseTypeGuid = this.column('weeztix_purchase_type_guid', 'string');
    weeztixPurchaseName = this.column('weeztix_purchase_name', 'string');
    weeztixPurchasePrice = this.column('weeztix_purchase_price', 'int');
    weeztixPurchaseCreated = this.column<Temporal.ZonedDateTime>('weeztix_purchase_created', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    weeztixPurchaseUpdated = this.column<Temporal.ZonedDateTime>('weeztix_purchase_updated', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    weeztixPurchaseDeleted = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('weeztix_purchase_deleted', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);

    constructor() {
        super('weeztix_purchases');
    }
}

export const tWeeztixPurchases = new WeeztixPurchasesTable();

