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

export class EnvironmentsEventsTable extends Table<DBConnection, 'EnvironmentsEventsTable'> {
    environmentId = this.column('environment_id', 'int');
    eventId = this.column('event_id', 'int');
    environmentAcceptApplicationsStart = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('environment_accept_applications_start', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    environmentAcceptApplicationsEnd = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('environment_accept_applications_end', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    environmentPublishContentStart = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('environment_publish_content_start', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    environmentPublishContentEnd = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('environment_publish_content_end', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    environmentPublishPortalStart = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('environment_publish_portal_start', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    environmentPublishPortalEnd = this.optionalColumnWithDefaultValue<Temporal.ZonedDateTime>('environment_publish_portal_end', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);

    constructor() {
        super('environments_events');
    }
}

export const tEnvironmentsEvents = new EnvironmentsEventsTable();

