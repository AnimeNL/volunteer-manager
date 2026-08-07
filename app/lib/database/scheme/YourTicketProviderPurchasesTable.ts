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

export class YourTicketProviderPurchasesTable extends Table<DBConnection, 'YourTicketProviderPurchasesTable'> {
    ytpPurchaseId = this.column('ytp_purchase_id', 'int');
    ytpPurchaseEventId = this.column('ytp_purchase_event_id', 'int');
    ytpPurchaseComplimentary = this.column('ytp_purchase_complimentary', 'int');
    ytpPurchaseDateCancelled = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('ytp_purchase_date_cancelled', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    ytpPurchaseDatePaid = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('ytp_purchase_date_paid', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    ytpPurchaseItemId = this.column('ytp_purchase_item_id', 'int');
    ytpPurchaseItemTicketId = this.column('ytp_purchase_item_ticket_id', 'int');
    ytpPurchaseItemBarcode = this.column('ytp_purchase_item_barcode', 'string');
    ytpPurchaseItemHolder = this.optionalColumnWithDefaultValue('ytp_purchase_item_holder', 'string');
    ytpPurchaseItemUpdated = this.column<Temporal.ZonedDateTime>('ytp_purchase_item_updated', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);

    constructor() {
        super('your_ticket_provider_purchases');
    }
}

export const tYourTicketProviderPurchases = new YourTicketProviderPurchasesTable();

