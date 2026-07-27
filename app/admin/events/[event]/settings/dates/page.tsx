// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import EditCalendarIcon from '@mui/icons-material/EditCalendar';

import { DataTable, createDataSource, kEventTransformer, withContext, withRowModel, type Column,
    type ExtractRowModel } from '@app/admin/components/DataTable';
import { CompletedCell, CompletedHeader, OwnerCell } from './DatesCells';
import { LogBuilder } from '@lib/log/index';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getLeadersForEvent } from '@app/admin/lib/getLeadersForEvent';
import { requireAuthenticationContextWithEvent } from '../../requireAuthenticationContextWithEvent';
import db, { tEventsDates, tUsers } from '@lib/database';

import { kDateType, type DateType } from '@lib/database/Types';

/**
 * Labels to use when allowing configuration of deadline / highlight dates.
 */
const kDateTypeLabel: { [k in DateType]: string } = {
    Deadline: 'Deadline',
    Highlight: 'Highlight (both)',
    HighlightFinance: 'Highlight (finance)',
    HighlightVolunteers: 'Highlight (volunteers)'
};

/**
 * Data source for the dates of an event.
 */
const eventDatesDataSource = createDataSource('admin/event/settings/dates', withContext({
    /**
     * Event for which the dates are being obtained.
     */
    event: kEventTransformer,

}), withRowModel({
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
    title: z.string().nonempty(),

    /**
     * Description explaining what this date is about.
     */
    description: z.string().nonempty(),

    /**
     * User ID of the person responsible for delivering on this date.
     */
    ownerUserId: z.number().nullish(),

    /**
     * Whether the date has been completed.
     */
    completed: z.boolean(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: context.event.slug,
            permission: {
                permission: 'event.settings',
                scope: {
                    event: context.event.slug,
                },
            },
        });
    },

    async create(partialRow, props, context) {
        if (!partialRow.date || !partialRow.type || !partialRow.title || !partialRow.description)
            return false;  // required columns

        const insertId = await db.insertInto(tEventsDates)
            .set({
                eventId: context.event.id,
                dateOwnerId: props.user.id,
                dateType: partialRow.type,
                dateDate: Temporal.PlainDate.from(partialRow.date),
                dateTitle: partialRow.title,
                dateDescription: partialRow.description,
                dateCompleted: null,
                dateDeleted: null,
            })
            .returningLastInsertedId()
            .executeInsert();

        LogBuilder.for('CreateEventKeyDate')
            .withCondition(!!insertId)
            .withInitiatorUser(props.user)
            .record({ event: context.event.shortName });

        return !!insertId;
    },

    async delete(row, props, context) {
        const event = context.event;
        const dbInstance = db;
        const affectedRows = await dbInstance.update(tEventsDates)
            .set({
                dateDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tEventsDates.dateId.equals(row.id))
                .and(tEventsDates.eventId.equals(event.id))
                .and(tEventsDates.dateDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('DeleteEventKeyDate')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .record({
                event: event.shortName,
                title: row.title,
            });

        return !!affectedRows;
    },

    async list(params, props, context) {
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
            .where(tEventsDates.eventId.equals(context.event.id))
                .and(tEventsDates.dateDeleted.isNull())
                .and(tEventsDates.dateTitle.containsInsensitiveIfValue(params.search).or(
                     tEventsDates.dateDescription.containsInsensitiveIfValue(params.search)))
            .orderBy(params.sort.field ?? 'date', params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: dates.count,
            rows: dates.data,
        };
    },

    async update(row, previousRow, props, context) {
        const dbInstance = db;
        const affectedRows = await dbInstance.update(tEventsDates)
            .set({
                dateDate: Temporal.PlainDate.from(row.date),
                dateType: row.type,
                dateOwnerId: row.ownerUserId || null,
                dateTitle: row.title,
                dateDescription: row.description,
                dateCompleted: row.completed ? dbInstance.currentZonedDateTime() : null,
            })
            .where(tEventsDates.dateId.equals(row.id))
                .and(tEventsDates.eventId.equals(context.event.id))
                .and(tEventsDates.dateDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('UpdateEventKeyDate')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withDiff({
                Completed: {
                    before: previousRow.completed,
                    after: row.completed,
                },
                Description: {
                    before: previousRow.description,
                    after: row.description,
                },
                Owner: {
                    before: previousRow.ownerUserId || 0,
                    after: row.ownerUserId || 0,
                },
                Title: {
                    before: previousRow.title,
                    after: row.title,
                },
            })
            .record({
                event: context.event.shortName,
                title: row.title,
            });

        return !!affectedRows;
    },
});

/**
 * Page through which the important dates for a particular event can be configured.
 */
export default async function EventSettingsDatesPage(
    props: PageProps<'/admin/events/[event]/settings/dates'>)
{
    const params = await props.params;
    const { event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'event.settings',
        scope: {
            event: params.event,
        },
    });

    const leaders = await getLeadersForEvent(event.id);

    const columns: Column<ExtractRowModel<typeof eventDatesDataSource>>[] = [
        {
            field: 'date',
            headerName: 'Date',
            editable: true,
            sortable: true,
            width: 115,

            template: 'date',

            editorProps: {
                placeholder: 'YYYY-MM-DD',
                required: true,
            },
        },
        {
            field: 'type',
            headerName: 'Type',
            editable: true,
            sortable: true,
            width: 175,

            type: 'singleSelect',
            valueOptions: Object.values(kDateType).map(type =>
                ({ label: kDateTypeLabel[type], value: type })),

            editorProps: {
                required: true,
            },
        },
        {
            field: 'title',
            headerName: 'Title',
            editable: true,
            sortable: true,
            flex: 1,

            editorProps: {
                required: true,
            },
        },
        {
            field: 'description',
            headerName: 'Description',
            editable: true,
            flex: 2,

            editorProps: {
                required: true,
            },
        },
        {
            field: 'ownerUserId',
            headerName: 'Owner',
            editable: true,
            sortable: true,
            type: 'singleSelect',
            valueOptions: [ { value: 0, label: ' ' }, ...leaders ],
            flex: 1,

            template: 'component',
            templateProps: {
                component: OwnerCell,
                componentContext: { leaders },
            },
        },
        {
            field: 'completed',
            headerAlign: 'center',
            headerName: 'Completed',
            align: 'center',
            editable: true,
            sortable: false,
            type: 'boolean',
            width: 50,

            template: 'component',
            templateProps: {
                component: CompletedCell,
                headerComponent: CompletedHeader,
            },
        },
    ];

    return (
        <>
            <Section icon={ <EditCalendarIcon color="primary" /> } title="Key dates"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Settings', href: `/admin/events/${event.slug}/settings` },
                        { label: 'Important dates' },
                     ]}>
                <SectionIntroduction>
                    Important deadlines and highlights during {event.shortName} organisation.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={eventDatesDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'date', sort: 'asc' }}
                           subject="key date" disableFooter
                           listViewProps={{
                               primaryField: 'title',
                               secondaryTemplate: '{description}',
                               dateField: 'date',
                               startComponent: CompletedCell,
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Key dates', 'Settings', { event: 'event' });
