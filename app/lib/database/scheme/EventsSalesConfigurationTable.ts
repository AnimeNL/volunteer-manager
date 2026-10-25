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

export const kSaleCategory = {
    Event: "Event",
    Hidden: "Hidden",
    Locker: "Locker",
    LockerFriday: "LockerFriday",
    LockerSaturday: "LockerSaturday",
    LockerSunday: "LockerSunday",
    LockerWeekend: "LockerWeekend",
    TicketFriday: "TicketFriday",
    TicketSaturday: "TicketSaturday",
    TicketSunday: "TicketSunday",
    TicketWeekend: "TicketWeekend",
} as const;

export type SaleCategory = keyof typeof kSaleCategory;

export class EventsSalesConfigurationTable extends Table<DBConnection, 'EventsSalesConfigurationTable'> {
    eventId = this.column('event_id', 'int');
    saleId = this.column('sale_id', 'int');
    saleCategory = this.optionalColumnWithDefaultValue<EventTicketCategory>('sale_category', 'enum', 'EventTicketCategory');
    saleCategoryLimit = this.optionalColumnWithDefaultValue('sale_category_limit', 'int');
    saleDescription = this.optionalColumnWithDefaultValue('sale_description', 'string');
    salePrice = this.optionalColumnWithDefaultValue('sale_price', 'double');
    saleProduct = this.column('sale_product', 'string');
    saleEventId = this.optionalColumnWithDefaultValue('sale_event_id', 'int');

    constructor() {
        super('events_sales_configuration');
    }
}

export const tEventsSalesConfiguration = new EventsSalesConfigurationTable();

