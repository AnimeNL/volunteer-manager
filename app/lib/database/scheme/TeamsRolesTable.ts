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

export class TeamsRolesTable extends Table<DBConnection, 'TeamsRolesTable'> {
    teamId = this.column('team_id', 'int');
    roleId = this.column('role_id', 'int');
    roleDefault = this.columnWithDefaultValue('role_default', 'int');

    constructor() {
        super('teams_roles');
    }
}

export const tTeamsRoles = new TeamsRolesTable();

