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

export class WeeztixTicketsTable extends Table<DBConnection, 'WeeztixTicketsTable'> {
    weeztixGuid = this.column('weeztix_guid', 'string');
    weeztixOrderGuid = this.column('weeztix_order_guid', 'string');
    weeztixEventGuid = this.column('weeztix_event_guid', 'string');
    weeztixTicketTypeGuid = this.column('weeztix_ticket_type_guid', 'string');
    weeztixTicketBarcode = this.column('weeztix_ticket_barcode', 'string');
    weeztixTicketName = this.optionalColumnWithDefaultValue('weeztix_ticket_name', 'string');
    weeztixTicketPrice = this.column('weeztix_ticket_price', 'int');
    weeztixTicketCreated = this.column<Temporal.ZonedDateTime>('weeztix_ticket_created', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    weeztixTicketUpdated = this.column<Temporal.ZonedDateTime>('weeztix_ticket_updated', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    weeztixTicketDeleted = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('weeztix_ticket_deleted', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);

    constructor() {
        super('weeztix_tickets');
    }
}

export const tWeeztixTickets = new WeeztixTicketsTable();

