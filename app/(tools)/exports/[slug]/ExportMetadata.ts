// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ExportType } from '@lib/database/Types';

/**
 * Interface that describes the metadata associated with a data export.
 */
export interface ExportMetadata {
    /**
     * Unique slug of the export as it exists in the database.
     */
    slug: string;

    /**
     * Unique ID of the event that this export is associated with.
     */
    eventId: number;

    /**
     * Short name of the event that this export is associated with.
     */
    eventName: string;

    /**
     * Type of data that is being described by this export.
     */
    type: ExportType;

    /**
     * Full name of the user who is responsible for creating this export.
     */
    userName: string;

    /**
     * Whether the export is enabled. (I.e. manual deletion.)
     */
    enabled: boolean;

    /**
     * Whether date limits to the export's availability are still valid.
     */
    accessDateValid: boolean;

    /**
     * Whether view limits to the export's availability are still valid.
     */
    accessViewsValid: boolean;
}
