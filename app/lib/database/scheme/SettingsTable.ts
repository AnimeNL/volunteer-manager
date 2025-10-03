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

export class SettingsTable extends Table<DBConnection, 'SettingsTable'> {
    settingName = this.column('setting_name', 'string');
    settingValue = this.column('setting_value', 'string');

    constructor() {
        super('settings');
    }
}

export const tSettings = new SettingsTable();

