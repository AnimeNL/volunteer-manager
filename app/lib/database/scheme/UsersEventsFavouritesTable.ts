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

export class UsersEventsFavouritesTable extends Table<DBConnection, 'UsersEventsFavouritesTable'> {
    userId = this.column('user_id', 'int');
    eventId = this.column('event_id', 'int');
    activityId = this.column('activity_id', 'int');

    constructor() {
        super('users_events_favourites');
    }
}

export const tUsersEventsFavourites = new UsersEventsFavouritesTable();

