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

export class DutyBookViewersTable extends Table<DBConnection, 'DutyBookViewersTable'> {
    dutyBookId = this.column('duty_book_id', 'int');
    dutyBookViewerUserId = this.column('duty_book_viewer_user_id', 'int');
    dutyBookViewerDate = this.columnWithDefaultValue<Temporal.ZonedDateTime>('duty_book_viewer_date', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);

    constructor() {
        super('duty_book_viewers');
    }
}

export const tDutyBookViewers = new DutyBookViewersTable();

