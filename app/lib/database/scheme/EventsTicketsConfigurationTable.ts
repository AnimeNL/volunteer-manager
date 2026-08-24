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
    EventTicketCategory,
} from "../Types";

export class EventsTicketsConfigurationTable extends Table<DBConnection, 'EventsTicketsConfigurationTable'> {
    eventId = this.column('event_id', 'int');
    eventTicketYtpId = this.column('event_ticket_ytp_id', 'int');
    eventTicketCategory = this.optionalColumnWithDefaultValue<EventTicketCategory>('event_ticket_category', 'enum', 'EventTicketCategory');
    eventTicketActivityId = this.optionalColumnWithDefaultValue('event_ticket_activity_id', 'int');

    constructor() {
        super('events_tickets_configuration');
    }
}

export const tEventsTicketsConfiguration = new EventsTicketsConfigurationTable();

