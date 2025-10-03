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
    RetentionStatus,
} from "../Types";

export class RetentionTable extends Table<DBConnection, 'RetentionTable'> {
    userId = this.column('user_id', 'int');
    eventId = this.column('event_id', 'int');
    teamId = this.column('team_id', 'int');
    retentionStatus = this.optionalColumnWithDefaultValue<RetentionStatus>('retention_status', 'enum', 'RetentionStatus');
    retentionAssigneeId = this.optionalColumnWithDefaultValue('retention_assignee_id', 'int');
    retentionNotes = this.optionalColumnWithDefaultValue('retention_notes', 'string');

    constructor() {
        super('retention');
    }
}

export const tRetention = new RetentionTable();

