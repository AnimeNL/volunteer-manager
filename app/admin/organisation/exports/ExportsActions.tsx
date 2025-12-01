// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { nanoid } from 'nanoid';
import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { ExportType } from '@lib/database/Types';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { Temporal } from '@lib/Temporal';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tEvents, tExports } from '@lib/database';

/**
 * Zod type that describes information required to create a common export.
 */
const kCreateSimpleExportData = z.object({
    availability: z.number().min(1).max(24 * 7 * 2),
    event: z.number(),
    justification: z.string().nonempty(),
    team: z.number().optional(),
    views: z.number().min(1).max(50),
});

/**
 * Server action that creates a new data export using the common properties.
 */
export async function createSimpleExport(type: ExportType, formData: unknown) {
    'use server';
    return executeServerAction(formData, kCreateSimpleExportData, async (data, props) => {
        await requireAuthenticationContext({
            check: 'admin',
            permission: 'organisation.exports',
        });

        const dbInstance = db;
        const event = await dbInstance.selectFrom(tEvents)
            .where(tEvents.eventId.equals(data.event))
                .and(tEvents.eventHidden.equals(/* false= */ 0))
            .select({
                shortName: tEvents.eventShortName,
            })
            .executeSelectNoneOrOne();

        if (!event)
            notFound();

        const slug = nanoid(/* size= */ 16);
        if (!slug || slug.length !== 16)
            return { success: false, error: 'Unable to generate an export slug…' };

        const insertId = await dbInstance.insertInto(tExports)
            .set({
                exportSlug: slug,
                exportEventId: data.event,
                exportTeamId: data.team,
                exportType: type,
                exportJustification: data.justification,
                exportCreatedDate: dbInstance.currentZonedDateTime(),
                exportCreatedUserId: props.user.id,
                exportExpirationDate:
                    Temporal.Now.zonedDateTimeISO().add({ days: data.availability }),
                exportExpirationViews: data.views,
                exportEnabled: /* true= */ 1,
            })
            .returningLastInsertedId()
            .executeInsert();

        if (!insertId)
            return { success: false, error: 'Unable to store the export in the database…' };

        RecordLog({
            type: kLogType.AdminExportMutation,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                eventName: event.shortName,
                mutation: 'Created',
                type,
            },
        });

        return {
            success: true,
            message: 'The data has been exported—you are being redirected…',
            redirect: `/admin/organisation/exports/${insertId}`,
        };
    });
}

/**
 * Zod type that describes that no information is required.
 */
const kNoDataRequired = z.object({ /* no parameters */ });

/**
 * Server action that can be used to expire a data export, rendering it inaccessible.
 */
export async function expireExport(exportId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kNoDataRequired, async (data, props) => {
        await requireAuthenticationContext({
            check: 'admin',
            permission: 'organisation.exports',
        });

        const info = await db.selectFrom(tExports)
            .innerJoin(tEvents)
                .on(tEvents.eventId.equals(tExports.exportEventId))
            .where(tExports.exportId.equals(exportId))
            .select({
                shortName: tEvents.eventShortName,
                type: tExports.exportType,
            })
            .executeSelectNoneOrOne();

        if (!info)
            notFound();

        const affectedRows = await db.update(tExports)
            .set({
                exportEnabled: /* false= */ 0
            })
            .where(tExports.exportId.equals(exportId))
                .and(tExports.exportEnabled.equals(/* true= */ 1))
            .executeUpdate();

        if (!affectedRows)
            return { success: false, error: 'Unable to expire the export in the database…' };

        RecordLog({
            type: kLogType.AdminExportMutation,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                eventName: info.shortName,
                mutation: 'Expired',
                type: info.type,
            },
        });

        return {
            success: true,
            refresh: true,
            message: 'Access to the data has been revoked.',
        };
    });
}
