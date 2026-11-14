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
    WeeztixTicketType,
} from "../Types";

export class WeeztixTicketTypesTable extends Table<DBConnection, 'WeeztixTicketTypesTable'> {
    weeztixGuid = this.column('weeztix_guid', 'string');
    weeztixEventGuid = this.column('weeztix_event_guid', 'string');
    weeztixTicketType = this.column<WeeztixTicketType>('weeztix_ticket_type', 'enum', 'WeeztixTicketType');
    weeztixTicketName = this.column('weeztix_ticket_name', 'string');
    weeztixTicketDescription = this.optionalColumnWithDefaultValue('weeztix_ticket_description', 'string');
    weeztixTicketPrice = this.column('weeztix_ticket_price', 'int');
    weeztixTicketAvailable = this.column('weeztix_ticket_available', 'int');
    weeztixTicketSold = this.column('weeztix_ticket_sold', 'int');
    weeztixTicketScanned = this.column('weeztix_ticket_scanned', 'int');
    weeztixTicketStatus = this.column('weeztix_ticket_status', 'string');
    weeztixTicketCreated = this.column<Temporal.ZonedDateTime>('weeztix_ticket_created', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    weeztixTicketUpdated = this.column<Temporal.ZonedDateTime>('weeztix_ticket_updated', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    weeztixTicketDeleted = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('weeztix_ticket_deleted', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);

    constructor() {
        super('weeztix_ticket_types');
    }
}

export const tWeeztixTicketTypes = new WeeztixTicketTypesTable();

