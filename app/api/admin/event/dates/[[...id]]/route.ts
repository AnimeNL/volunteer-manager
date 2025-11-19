// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '../../../../createDataTableApi';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { Temporal } from '@lib/Temporal';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tEventsDates, tUsers } from '@lib/database';

import { kDateType } from '@lib/database/Types';

/**
 * Row model for a dates associated with a particular event.
 */
const kEventDatesRowModel = z.object({
    /**
     * Unique ID of the date as it exists in the database.
     */
    id: z.number(),

    /**
     * Date on which the date will expire.
     */
    date: z.string().regex(/^\d{4}\-\d{2}\-\d{2}$/),

    /**
     * Type of date that's being described by this row.
     */
    type: z.enum(kDateType),

    /**
     * Title of the date, giving a succint description of what it's about.
     */
    title: z.string(),

    /**
     * Description explaining what this date is about.
     */
    description: z.string(),

    /**
     * User ID of the person responsible for deliving on this date.
     */
    ownerUserId: z.number().optional(),

    /**
     * Whether the date has been completed.
     */
    completed: z.boolean(),
});

/**
 * This API is associated with a particular event.
 */
const kEventDatesContext = z.object({
    context: z.object({
        /**
         * Unique slug of the event that the date is in scope of.
         */
        event: z.string(),
    }),
});

/**
 * Export type definitions so that the API can be used in `callApi()`.
 */
export type EventDatesEndpoints =
    DataTableEndpoints<typeof kEventDatesRowModel, typeof kEventDatesContext>;

/**
 * Export type definition for the API's Row Model.
 */
export type EventDatesRowModel = z.infer<typeof kEventDatesRowModel>;

/**
 * This is implemented as a regular DataTable API. The following endpoints are provided by this
 * implementation:
 *
 *     GET    /api/admin/event/dates
 *     DELETE /api/admin/event/dates/:id
 *     POST   /api/admin/event/dates
 *     PUT    /api/admin/event/dates/:id
 */
export const { GET, DELETE, POST, PUT } =
createDataTableApi(kEventDatesRowModel, kEventDatesContext, {
    async accessCheck({ context }, action, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: context.event,
            permission: {
                permission: 'event.settings',
                scope: {
                    event: context.event,
                },
            },
        });
    },

    async create({ context }, props) {
        const event = await getEventBySlug(context.event);
        if (!event || !props.user)
            notFound();

        const dateDate = event.temporalStartTime.toPlainDate();

        const kDateTitle = 'New date';
        const kDateDescription = 'Brief description of what is expected, by who.';

        const insertId = await db.insertInto(tEventsDates)
            .set({
                eventId: event.id,
                dateOwnerId: props.user.id,
                dateType: kDateType.Deadline,
                dateDate: dateDate,
                dateTitle: kDateTitle,
                dateDescription: kDateDescription,
                dateCompleted: null,
                dateDeleted: null,
            })
            .returningLastInsertedId()
            .executeInsert();

        return {
            success: true,
            row: {
                id: insertId,
                date: dateDate.toString(),
                type: kDateType.Deadline,
                title: kDateTitle,
                description: kDateDescription,
                ownerUserId: props.user.id,
                completed: false,
            },
        };
    },

    async delete({ context, id }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tEventsDates)
            .set({
                dateDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tEventsDates.dateId.equals(id))
                .and(tEventsDates.eventId.equals(event.id))
                .and(tEventsDates.dateDeleted.isNull())
            .executeUpdate();

        return { success: !!affectedRows };
    },

    async list({ context, sort }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const usersJoin = tUsers.forUseInLeftJoin();

        const dbInstance = db;
        const dates = await dbInstance.selectFrom(tEventsDates)
            .leftJoin(usersJoin)
                .on(usersJoin.userId.equals(tEventsDates.dateOwnerId))
            .select({
                id: tEventsDates.dateId,
                date: dbInstance.dateAsString(tEventsDates.dateDate),
                type: tEventsDates.dateType,
                title: tEventsDates.dateTitle,
                description: tEventsDates.dateDescription,
                ownerUserId: usersJoin.userId,
                completed: tEventsDates.dateCompleted.isNotNull(),
            })
            .where(tEventsDates.eventId.equals(event.id))
                .and(tEventsDates.dateDeleted.isNull())
            .orderBy(sort?.field ?? 'date', sort?.sort ?? 'asc')
            .executeSelectPage();

        return {
            success: true,
            rowCount: dates.count,
            rows: dates.data,
        };
    },

    async update({ context, row }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tEventsDates)
            .set({
                dateDate: Temporal.PlainDate.from(row.date),
                dateType: row.type,
                dateOwnerId: row.ownerUserId,
                dateTitle: row.title,
                dateDescription: row.description,
                dateCompleted: row.completed ? dbInstance.currentZonedDateTime() : null,
            })
            .where(tEventsDates.dateId.equals(row.id))
                .and(tEventsDates.eventId.equals(event.id))
                .and(tEventsDates.dateDeleted.isNull())
            .executeUpdate();

        return { success: !!affectedRows };
    },

    async writeLog({ context }, mutation, props) {
        const event = await getEventBySlug(context.event);
        RecordLog({
            type: kLogType.AdminEventDateMutation,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                event: event!.shortName,
                mutation,
            },
        });
    },
});
