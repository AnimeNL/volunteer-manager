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

export class LogsFormatTable extends Table<DBConnection, 'LogsFormatTable'> {
    logType = this.column('log_type', 'string');
    logTypeVisible = this.column('log_type_visible', 'int');
    logFormat = this.optionalColumnWithDefaultValue('log_format', 'string');
    logFormatUpdated = this.column<Temporal.ZonedDateTime>('log_format_updated', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);

    constructor() {
        super('logs_format');
    }
}

export const tLogsFormat = new LogsFormatTable();

