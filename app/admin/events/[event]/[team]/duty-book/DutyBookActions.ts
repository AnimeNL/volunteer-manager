// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeServerAction } from '@lib/serverAction';
import db, { tDutyBook, tEvents } from '@lib/database';

/**
 * Retrieves the name and slug of the given `eventId` from the database. Resolves to `undefined`
 * when that event is not accessible for any reason.
 */
async function getEventNameAndSlug(eventId: number): Promise<{ name: string, slug: string } | null>
{
    return db.selectFrom(tEvents)
        .where(tEvents.eventId.equals(eventId))
        .select({
            name: tEvents.eventShortName,
            slug: tEvents.eventSlug,
        })
        .executeSelectNoneOrOne();
}


/**
 * Zod type that describes the data necessary to soft-remove a Duty Book entry.
 */
const kDeleteIncidentData = z.object({ /* nothing */ });

/**
 * Server action that soft deletes a Duty Book entry. Data remains in the database.
 */
export async function deleteIncident(eventId: number, dutyBookId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kDeleteIncidentData, async (data, props) => {
        const event = await getEventNameAndSlug(eventId);
        if (!event)
            notFound();

        if (!props.access.can('event.duty-book', { event: event.slug }))
            forbidden();

        const dbInstance = db;

        const affectedRows = await dbInstance.update(tDutyBook)
            .set({
                dutyBookDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tDutyBook.dutyBookId.equals(dutyBookId))
                .and(tDutyBook.dutyBookDeleted.isNull())
            .executeUpdate();

        if (!!affectedRows) {
            RecordLog({
                type: kLogType.AdminDeleteDutyBook,
                severity: kLogSeverity.Warning,
                sourceUser: props.user,
                data: {
                    id: dutyBookId,
                    event: event.name,
                    hidden: data.hidden,
                },
            });
        }

        return {
            success: true,
            redirect: /* the duty book overview page= */ '../duty-book',
        };
    });
}

/**
 * Zod type that describes data necessary to update a Duty Book entry.
 */
const kUpdateDetailsData = z.object({
    summary: z.string().optional(),
    incident: z.string(),
});

/**
 * Server action that updates the details associated with a Duty Book entry.
 */
export async function updateDetails(eventId: number, dutyBookId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kUpdateDetailsData, async (data, props) => {
        const event = await getEventNameAndSlug(eventId);
        if (!event)
            notFound();

        if (!props.access.can('event.duty-book', { event: event.slug }))
            forbidden();

        const dbInstance = db;

        const affectedRows = await dbInstance.update(tDutyBook)
            .set({
                dutyBookAiSummary: data.summary,
                dutyBookIncident: data.incident,
            })
            .where(tDutyBook.dutyBookId.equals(dutyBookId))
                .and(tDutyBook.dutyBookDeleted.isNull())
            .executeUpdate();

        if (!!affectedRows) {
            RecordLog({
                type: kLogType.AdminUpdateDutyBookDetails,
                severity: kLogSeverity.Info,
                sourceUser: props.user,
                data: {
                    id: dutyBookId,
                    event: event.name,
                    incident: data.incident,
                    summary: data.summary,
                },
            });
        }

        return { success: true };
    });
}

/**
 * Zod type that describes that an application decision has been made.
 */
const kUpdateVisibilityData = z.object({
    hidden: z.boolean(),
});

/**
 * Server action that updates the visibility status of a Duty Book entry. Hidden entries don't
 * reveal all information to volunteers, useful in case they contain sensitive information.
 */
export async function updateVisibility(eventId: number, dutyBookId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kUpdateVisibilityData, async (data, props) => {
        const event = await getEventNameAndSlug(eventId);
        if (!event)
            notFound();

        if (!props.access.can('event.duty-book', { event: event.slug }))
            forbidden();

        const dbInstance = db;

        const affectedRows = await dbInstance.update(tDutyBook)
            .set({
                dutyBookHidden:
                    data.hidden ? dbInstance.currentZonedDateTime()
                                : null,
            })
            .where(tDutyBook.dutyBookId.equals(dutyBookId))
                .and(tDutyBook.dutyBookDeleted.isNull())
            .executeUpdate();

        if (!!affectedRows) {
            RecordLog({
                type: kLogType.AdminUpdateDutyBookVisibility,
                severity: kLogSeverity.Warning,
                sourceUser: props.user,
                data: {
                    id: dutyBookId,
                    event: event.name,
                    hidden: data.hidden,
                },
            });
        }

        return { success: true };
    });
}
