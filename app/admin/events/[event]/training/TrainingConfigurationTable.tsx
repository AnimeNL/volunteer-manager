// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { TrainingsRowModel } from '@app/api/admin/trainings/[[...id]]/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { formatDate } from '@lib/Temporal';

/**
 * Converts the given `date` in the user's local timezone to a Temporal `ZonedDateTime` object.
 */
function fromLocalDate(date: Date): Temporal.ZonedDateTime {
    return Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO('UTC');
}

/**
 * Converts the given `input` to a regular JavaScript `Date` object.
 */
function toLocalDate(input: Temporal.ZonedDateTime): Date {
    return new Date(
        input.withTimeZone(Temporal.Now.timeZoneId()).epochMilliseconds);
}


/**
 * Props accepted by the <TrainingConfigurationTable> component.
 */
interface TrainingConfigurationTableProps {
    /**
     * The event for which this table is being displayed.
     */
    event: string;

    /**
     * Timezone in which displayed dates and times should be interpret.
     */
    timezone: string;
}

/**
 * The <TrainingConfigurationTable> component displays the options that are available for our
 * volunteers to get trained ahead of the convention.
 */
export function TrainingConfigurationTable(props: TrainingConfigurationTableProps) {
    const context = { event: props.event };
    const columns: RemoteDataTableColumn<TrainingsRowModel>[] = [
        {
            field: 'id',
            headerName: /* empty= */ '',
            sortable: false,
            width: 50,
        },
        {
            field: 'start',
            headerName: 'Date (start time)',
            type: 'dateTime',
            editable: true,
            sortable: true,
            flex: 2,

            valueGetter: (value, row) => toLocalDate(Temporal.ZonedDateTime.from(row.start)),
            valueSetter: (value, row) => ({
                ...row,
                start: fromLocalDate(value).toString(),
            }),

            renderCell: params =>
                formatDate(
                    Temporal.ZonedDateTime.from(params.row.start).withTimeZone(props.timezone),
                    'YYYY-MM-DD [at] H:mm'),
        },
        {
            field: 'end',
            headerName: 'Date (end time)',
            type: 'dateTime',
            editable: true,
            sortable: true,
            flex: 2,

            valueGetter: (value, row) => toLocalDate(Temporal.ZonedDateTime.from(row.end)),
            valueSetter: (value, row) => ({
                ...row,
                end: fromLocalDate(value).toString(),
            }),

            renderCell: params =>
                formatDate(
                    Temporal.ZonedDateTime.from(params.row.end).withTimeZone(props.timezone),
                    'YYYY-MM-DD [at] H:mm'),
        },
        {
            field: 'address',
            headerName: 'Address',
            editable: true,
            sortable: true,
            flex: 3,
        },
        {
            field: 'capacity',
            headerName: 'Capacity',
            editable: true,
            sortable: true,
            type: 'number',
            flex: 1,
        },
    ];

    return (
        <RemoteDataTable endpoint="/api/admin/trainings" context={context}
                         columns={columns} defaultSort={{ field: 'start', sort: 'asc' }}
                         disableFooter enableCreate enableDelete enableUpdate
                         refreshOnUpdate subject="training" />
    );
}
