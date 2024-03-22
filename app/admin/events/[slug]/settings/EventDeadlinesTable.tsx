// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { ValueOptions } from '@mui/x-data-grid-pro';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { EventDeadlinesRowModel } from '@app/api/admin/event/deadlines/[[...id]]/route';
import type { PageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';

/**
 * Returns a stringified, ISO representation of the given `input`.
 */
function toDateString(input?: Date): string {
    input = input ?? new Date;

    const month = `0${input.getMonth() + 1}`.substr(-2);
    const date = `0${input.getDate()}`.substr(-2);

    return `${input.getFullYear()}-${month}-${date}`;
}

/**
 * Props accepted by the <EventDeadlinesTable> component.
 */
export interface EventDeadlinesTableProps {
    /**
     * Information about the event whose settings are being changed.
     */
    event: PageInfo['event'];

    /**
     * Leaders to whom a deadline can be assigned.
     */
    leaders: ValueOptions[];
}

/**
 * The <EventDeadlinesTable> component allows event administrators to indicate what the deadlines
 * are for a particular event. Such deadlines will be surfaced on the event dashboard page. They can
 * be marked as complete in order to hide them.
 */
export function EventDeadlinesTable(props: EventDeadlinesTableProps) {
    const context = { event: props.event.slug };
    const columns: RemoteDataTableColumn<EventDeadlinesRowModel>[] = [
        {
            field: 'id',
            headerAlign: 'center',
            align: 'center',
            editable: false,
            width: 50,
        },
        {
            field: 'date',
            headerName: 'Date',
            editable: true,
            sortable: true,
            width: 125,

            type: 'date',
            valueGetter: (value, row) => new Date(row.date),
            valueSetter: (value, row) => ({
                ...row,
                date: toDateString(value),
            }),

            renderCell: params => params.row.date,
        },
        {
            field: 'title',
            headerName: 'Title',
            editable: true,
            sortable: true,
            flex: 1,
        },
        {
            field: 'description',
            headerName: 'Description',
            editable: true,
            flex: 2,
        },
        {
            field: 'ownerUserId',
            headerName: 'Owner',
            editable: true,
            sortable: true,
            flex: 1,

            type: 'singleSelect',
            valueOptions: [ { value: 0, label: ' ' }, ...props.leaders ],

            renderCell: params => {
                if (!!params.value) {
                    for (const leader of props.leaders) {
                        if (typeof leader === 'object' && leader.value === params.value)
                            return leader.label;
                    }
                }

                return (
                    <Typography variant="body2"
                                sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                        Unassigned
                    </Typography>
                );
            }
        },
        {
            field: 'completed',
            headerAlign: 'center',
            headerName: /* empty= */ '',
            align: 'center',
            editable: true,
            type: 'boolean',
            width: 50,

            renderHeader: () =>
                <Tooltip title="Has the task been completed?">
                    <RadioButtonUncheckedIcon fontSize="small" color="primary" />
                </Tooltip>,

            renderCell: params =>
                !!params.value ? <CheckCircleIcon fontSize="small" color="success" />
                               : <CancelIcon fontSize="small" color="error" />,
        }
    ];

    return (
        <RemoteDataTable columns={columns} endpoint="/api/admin/event/deadlines" context={context}
                         disableFooter enableCreate enableDelete enableUpdate
                         defaultSort={{ field: 'date', sort: 'asc' }} subject="deadline" />
    );
}
