// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import WarningOutlinedIcon from '@mui/icons-material/WarningOutlined';

import type { ProgramChangesRowModel, ProgramChangesContext } from '@app/api/admin/program/changes/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { Temporal, formatDate } from '@lib/Temporal';

import { kMutationSeverity } from '@lib/database/Types';

/**
 * Props accepted by the <ProgramHistory> component.
 */
export type ProgramHistoryProps = ProgramChangesContext & {};

/**
 * The <ProgramHistory> component displays an overview of the most recent changes that were made to
 * the program, both in the imported AnPlan data and changes made within our own modifications.
 */
export function ProgramHistory(props: ProgramHistoryProps) {
    const columns: RemoteDataTableColumn<ProgramChangesRowModel>[] = [
        {
            field: 'severity',
            display: 'flex',
            headerAlign: 'center',
            headerName: '',
            align: 'center',
            sortable: true,
            width: 50,

            renderHeader: () =>
                <Tooltip title="Priority of this change">
                    <CircleOutlinedIcon color="primary" fontSize="small" />
                </Tooltip>,

            renderCell: params => {
                switch (params.value) {
                    case kMutationSeverity.Low:
                        return <CircleOutlinedIcon color="action" />;
                    case kMutationSeverity.Moderate:
                        return <InfoOutlinedIcon color="info" />;
                    case kMutationSeverity.Important:
                        return <WarningOutlinedIcon color="warning" />;
                    default:
                        console.error(`Unrecognised severity: ${params.value}`);
                        return <ErrorOutlinedIcon color="error" />;
                }
            }
        },
        {
            field: 'date',
            headerName: 'Date',
            sortable: true,
            flex: 1,

            renderCell: params =>
                formatDate(Temporal.ZonedDateTime.from(params.value), 'YYYY-MM-DD HH:mm:ss'),
        },
        {
            field: 'change',
            headerName: 'Change',
            sortable: false,
            flex: 3,

            renderCell: params => {
                const linkBase = `/admin/events/${props.context.event}/program/`;
                let link: string | undefined;

                if ('areaId' in params.row.reference)
                    link = 'areas';
                else if ('locationId' in params.row.reference)
                    link = 'locations';
                else if ('activityId' in params.row.reference)
                    link = `activities/${params.row.reference.activityId}`;

                if (!link)
                    return params.value;

                return (
                    <MuiLink component={Link} href={linkBase + link}>
                        {params.value}
                    </MuiLink>
                );
            },
        },
        {
            field: 'user',
            headerName: 'Volunteer',
            sortable: false,
            flex: 2,

            renderCell: params => {
                if (!params.value || !params.value.name) {
                    return (
                        <Typography component="span" variant="body2"
                                    sx={{ color: 'text.disabled' }}>
                            AnPlan
                        </Typography>
                    );
                }

                if (!params.value.team)
                    return params.value.name;

                const userId = params.value.id;
                const team = params.value.team;

                const link = `/admin/events/${props.context.event}/${team}/volunteers/${userId}`;
                return (
                    <MuiLink component={Link} href={link}>
                        {params.value.name}
                    </MuiLink>
                );
            }
        }
    ];

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h5">
                Recent changes to the program
            </Typography>
            <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
                This table summarises changes made across the Volunteer Portal and{' '}
                <MuiLink href="https://anplan.animecon.nl/">AnPlan</MuiLink>, the official AnimeCon
                planning tool.
            </Alert>
            <RemoteDataTable columns={columns} endpoint="/api/admin/program/changes"
                             context={props.context} pageSize={10}
                             defaultSort={{ field: 'date', sort: 'desc' }} />
        </Paper>
    );
}
