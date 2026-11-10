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

export class EmailAccountsPermissionsTable extends Table<DBConnection, 'EmailAccountsPermissionsTable'> {
    emailAccountId = this.column('email_account_id', 'int');
    userId = this.column('user_id', 'int');
    permissionCreate = this.columnWithDefaultValue('permission_create', 'int');
    permissionRead = this.columnWithDefaultValue('permission_read', 'int');
    permissionUpdate = this.columnWithDefaultValue('permission_update', 'int');
    permissionDelete = this.columnWithDefaultValue('permission_delete', 'int');

    constructor() {
        super('email_accounts_permissions');
    }
}

export const tEmailAccountsPermissions = new EmailAccountsPermissionsTable();

