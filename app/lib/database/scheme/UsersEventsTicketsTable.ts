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
    EventTicketProvider,
} from "../Types";

export class UsersEventsTicketsTable extends Table<DBConnection, 'UsersEventsTicketsTable'> {
    userId = this.column('user_id', 'int');
    eventId = this.column('event_id', 'int');
    ticketProvider = this.column<EventTicketProvider>('ticket_provider', 'enum', 'EventTicketProvider');
    ticketProviderPurchaseId = this.column('ticket_provider_purchase_id', 'string');

    constructor() {
        super('users_events_tickets');
    }
}

export const tUsersEventsTickets = new UsersEventsTicketsTable();

