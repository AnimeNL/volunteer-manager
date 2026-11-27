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

export class TeamsVisibilityTable extends Table<DBConnection, 'TeamsVisibilityTable'> {
    teamId = this.column('team_id', 'int');
    visibleTeamId = this.column('visible_team_id', 'int');

    constructor() {
        super('teams_visibility');
    }
}

export const tTeamsVisibility = new TeamsVisibilityTable();

