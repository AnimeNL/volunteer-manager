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
import {
    ActivityType,
} from "../Types";
import {
    ZonedDateTime,
} from "../../Temporal";

export class ActivitiesLocationsTable extends Table<DBConnection, 'ActivitiesLocationsTable'> {
    locationId = this.column('location_id', 'int');
    locationFestivalId = this.column('location_festival_id', 'int');
    locationType = this.column<ActivityType>('location_type', 'enum', 'ActivityType');
    locationName = this.column('location_name', 'string');
    locationDisplayName = this.optionalColumnWithDefaultValue('location_display_name', 'string');
    locationAreaId = this.column('location_area_id', 'int');
    locationCreated = this.column<ZonedDateTime>('location_created', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    locationUpdated = this.column<ZonedDateTime>('location_updated', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    locationDeleted = this.optionalColumnWithDefaultValue<ZonedDateTime>('location_deleted', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);

    constructor() {
        super('activities_locations');
    }
}

export const tActivitiesLocations = new ActivitiesLocationsTable();

