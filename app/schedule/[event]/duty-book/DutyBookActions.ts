// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { AuthenticationContext } from '@lib/auth/AuthenticationContext';
import { DutyBookSummaryTask } from '@lib/scheduler/tasks/DutyBookSummaryTask';
import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import { getTeam } from '@lib/cache';
import { requireVolunteerAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tDutyBook, tDutyBookViewers } from '@lib/database';

import { kAnyTeam } from '@lib/auth/AccessList';

/**
 * Authenticates the volunteer for `eventSlug` and verifies that they have access to the Duty Book.
 */
async function requireDutyBookAccess(context: AuthenticationContext, eventSlug: string) {
    const { access, events, event } =
        await requireVolunteerAuthenticationWithEvent(context, eventSlug);

    if (!access.can('event.duty-book', 'read', { event: event.slug, team: kAnyTeam })) {
        const teamSlug = events.get(event.slug);
        const team = teamSlug ? await getTeam(teamSlug) : undefined;
        if (!team?.flags.enableDutyBook)
            forbidden();
    }

    return event;
}

/**
 * Zod type that describes the data required to mark a Duty Book incident as read.
 */
const kMarkIncidentAsReadData = z.object({
    /**
     * Unique slug of the event to which the Duty Book entry belongs.
     */
    event: z.string().nonempty(),

    /**
     * Unique ID of the Duty Book entry that the volunteer has read.
     */
    id: z.number(),
});

/**
 * Server Action that records that the signed-in volunteer has read a Duty Book entry.
 */
export async function markIncidentAsRead(formData: unknown) {
    return executeServerAction(formData, kMarkIncidentAsReadData, async (data, props) => {
        const event = await requireDutyBookAccess(props.authenticationContext, data.event);

        const dbInstance = db;
        const exists = await dbInstance.selectFrom(tDutyBook)
            .where(tDutyBook.dutyBookId.equals(data.id))
                .and(tDutyBook.dutyBookEventId.equals(event.id))
                .and(tDutyBook.dutyBookDeleted.isNull())
            .selectCountAll()
            .executeSelectOne();

        if (!exists)
            notFound();

        await dbInstance.insertInto(tDutyBookViewers)
            .values({
                dutyBookId: data.id,
                dutyBookViewerUserId: props.user.id,
                dutyBookViewerDate: dbInstance.currentZonedDateTime(),
            })
            .onConflictDoNothing()
            .executeInsert();

        return { success: true };
    });
}

/**
 * Zod type that describes the data required when reporting a new Duty Book incident.
 */
const kReportIncidentData = z.object({
    /**
     * Unique slug of the event for which the incident should be reported.
     */
    event: z.string().nonempty(),

    /**
     * The incident that's being reported by the signed-in user.
     */
    incident: z.string().min(8),
});

/**
 * Server Action through which volunteers can report new Duty Book incidents.
 */
export async function reportIncident(formData: unknown) {
    return executeServerAction(formData, kReportIncidentData, async (data, props) => {
        const event = await requireDutyBookAccess(props.authenticationContext, data.event);

        const dbInstance = db;

        // Step 1: Store the incident in the database
        const incidentId = await dbInstance.insertInto(tDutyBook)
            .values({
                dutyBookUserId: props.user.id,
                dutyBookEventId: event.id,
                dutyBookIncident: data.incident,
                dutyBookAiSummary: /* will be asynchronously generated= */ null,
                dutyBookCreated: dbInstance.currentZonedDateTime(),
                dutyBookUpdated: dbInstance.currentZonedDateTime(),
            })
            .returningLastInsertedId()
            .executeInsert();

        // Step 2: Mark the incident as read for the signed-in user
        await dbInstance.insertInto(tDutyBookViewers)
            .values({
                dutyBookId: incidentId,
                dutyBookViewerUserId: props.user.id,
                dutyBookViewerDate: dbInstance.currentZonedDateTime(),
            })
            .onConflictDoNothing()
            .executeInsert();

        // Step 3: Schedule a DutyBookSummaryTask to generate a summary and publish availability of
        // a new incident to subscribed leads out-of-band.
        await DutyBookSummaryTask.Schedule({
            id: incidentId,
        });

        // Step 4: Log that a new incident has been reported
        LogBuilder.for('CreateDutyBookIncident')
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                event: event.shortName,
                incidentId,
            });

        return {
            success: true,
            incidentId,
        };
    });
}
