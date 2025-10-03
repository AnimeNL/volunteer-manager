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
    EventSalesCategory,
} from "../Types";

export class EventsSalesConfigurationTable extends Table<DBConnection, 'EventsSalesConfigurationTable'> {
    eventId = this.column('event_id', 'int');
    saleId = this.column('sale_id', 'int');
    saleCategory = this.optionalColumnWithDefaultValue<EventSalesCategory>('sale_category', 'enum', 'EventSalesCategory');
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

