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

export class ActivitiesAreasTable extends Table<DBConnection, 'ActivitiesAreasTable'> {
    areaId = this.column('area_id', 'int');
    areaFestivalId = this.column('area_festival_id', 'int');
    areaType = this.column<ActivityType>('area_type', 'enum', 'ActivityType');
    areaName = this.column('area_name', 'string');
    areaDisplayName = this.optionalColumnWithDefaultValue('area_display_name', 'string');
    areaCreated = this.column<ZonedDateTime>('area_created', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    areaUpdated = this.column<ZonedDateTime>('area_updated', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);
    areaDeleted = this.optionalColumnWithDefaultValue<ZonedDateTime>('area_deleted', 'customLocalDateTime', 'dateTime', TemporalTypeAdapter);

    constructor() {
        super('activities_areas');
    }
}

export const tActivitiesAreas = new ActivitiesAreasTable();

