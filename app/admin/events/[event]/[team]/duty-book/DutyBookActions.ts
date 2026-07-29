// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import { getEvent } from '@lib/cache';
import db, { tDutyBook } from '@lib/database';

/**
 * Zod type that describes the data necessary to soft-remove a Duty Book entry.
 */
const kDeleteIncidentData = z.object({ /* nothing */ });

/**
 * Server action that soft deletes a Duty Book entry. Data remains in the database.
 */
export async function deleteIncident(
    eventSlug: string, teamSlug: string, incidentId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kDeleteIncidentData, async (data, props) => {
        const event = await getEvent(eventSlug);
        if (!event)
            notFound();

        if (!props.access.can('event.duty-book', 'delete', { event: event.slug, team: teamSlug }))
            forbidden();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tDutyBook)
            .set({
                dutyBookDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tDutyBook.dutyBookId.equals(incidentId))
                .and(tDutyBook.dutyBookDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('DeleteDutyBookIncident')
            .withInitiatorUser(props.user)
            .withCondition(!!affectedRows)
            .withSeverity('Warning')
            .record({
                event: event.name,
                incidentId,
            });

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
export async function updateDetails(
    eventSlug: string, teamSlug: string, incidentId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kUpdateDetailsData, async (data, props) => {
        const event = await getEvent(eventSlug);
        if (!event)
            notFound();

        if (!props.access.can('event.duty-book', 'update', { event: event.slug, team: teamSlug }))
            forbidden();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tDutyBook)
            .set({
                dutyBookAiSummary: data.summary,
                dutyBookIncident: data.incident,
            })
            .where(tDutyBook.dutyBookId.equals(incidentId))
                .and(tDutyBook.dutyBookDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('UpdateDutyBookIncident')
            .withInitiatorUser(props.user)
            .withCondition(!!affectedRows)
            .withSeverity('Info')
            .record({
                event: event.name,
                incidentId,
            });

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
export async function updateVisibility(
    eventSlug: string, teamSlug: string, incidentId: number, formData: unknown)
{
    'use server';
    return executeServerAction(formData, kUpdateVisibilityData, async (data, props) => {
        const event = await getEvent(eventSlug);
        if (!event)
            notFound();

        // Note: All (senior) volunteers with read access to Duty Book entries can hide them,
        // although the ability to delete and/or edit them is separately restricted.
        if (!props.access.can('event.duty-book', 'read', { event: event.slug, team: teamSlug }))
            forbidden();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tDutyBook)
            .set({
                dutyBookHidden:
                    data.hidden ? dbInstance.currentZonedDateTime()
                                : null,
            })
            .where(tDutyBook.dutyBookId.equals(incidentId))
                .and(tDutyBook.dutyBookDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('UpdateDutyBookIncidentVisibility')
            .withInitiatorUser(props.user)
            .withCondition(!!affectedRows)
            .withSeverity('Info')
            .record({
                event: event.name,
                incidentId,
            });

        return { success: true };
    });
}
