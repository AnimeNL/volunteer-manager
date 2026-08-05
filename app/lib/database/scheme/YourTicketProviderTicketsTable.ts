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

export class YourTicketProviderTicketsTable extends Table<DBConnection, 'YourTicketProviderTicketsTable'> {
    ytpTicketId = this.column('ytp_ticket_id', 'int');
    ytpTicketEventId = this.column('ytp_ticket_event_id', 'int');
    ytpTicketName = this.column('ytp_ticket_name', 'string');
    ytpTicketPrice = this.column('ytp_ticket_price', 'int');
    ytpTicketAmount = this.column('ytp_ticket_amount', 'int');
    ytpTicketCurrentAvailable = this.column('ytp_ticket_current_available', 'int');
    ytpTicketSoldOut = this.column('ytp_ticket_sold_out', 'int');
    ytpTicketLive = this.column('ytp_ticket_live', 'int');
    ytpTicketIsSubproduct = this.column('ytp_ticket_is_subproduct', 'int');
    ytpTicketSalesStart = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('ytp_ticket_sales_start', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    ytpTicketSalesEnd = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('ytp_ticket_sales_end', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    ytpTicketCreated = this.column<Temporal.ZonedDateTime>('ytp_ticket_created', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    ytpTicketUpdated = this.column<Temporal.ZonedDateTime>('ytp_ticket_updated', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    ytpTicketDeleted = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('ytp_ticket_deleted', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);

    constructor() {
        super('your_ticket_provider_tickets');
    }
}

export const tYourTicketProviderTickets = new YourTicketProviderTicketsTable();

