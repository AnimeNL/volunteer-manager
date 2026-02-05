// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useMemo } from 'react';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Collapse from '@mui/material/Collapse';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { TrainingsAssignmentsRowModel } from '@app/api/admin/trainings/assignments/[[...id]]/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';

/**
 * Props accepted by the <TrainingAssignments> component.
 */
interface TrainingAssignmentsProps {
    /**
     * Slug of the event for which assignments are being shown.
     */
    event: string;

    /**
     * Training configuration entries, which the preference/assignment options can be picked from.
     */
    trainings: { value: number; label: string; }[];

    /**
     * Warnings that should be displayed at the bottom of the assignment table.
     */
    warnings: { volunteer: string; warning: string }[];
}

/**
 * The <TrainingAssignments> component displays the volunteers who are eligible to participate in
 * the training sessions, their preferences and the decided (& confirmed) assignments.
 */
export function TrainingAssignments(props: TrainingAssignmentsProps) {
    const optionsMap = useMemo(() => {
        const optionsMap = new Map<number, string>();
        for (const option of props.trainings)
            optionsMap.set(option.value, option.label);

        return optionsMap;
    }, [ props.trainings ]);

    const context = { event: props.event };
    const columns: RemoteDataTableColumn<TrainingsAssignmentsRowModel>[] = [
        {
            field: 'name',
            headerName: 'Participant',
            editable: false,
            sortable: true,
            flex: 1,

            renderCell: params => {
                if (!params.row.userId || !params.row.team)
                    return params.value;

                const href = `./${params.row.team}/volunteers/${params.row.userId}`;
                return (
                    <MuiLink component={Link} href={href}>
                        {params.value}
                    </MuiLink>
                );
            },
        },
        {
            display: 'flex',
            field: 'preferredTrainingId',
            headerName: 'Preference',
            editable: false,
            sortable: true,
            flex: 1,

            renderCell: params => {
                if (params.value === undefined) {
                    return (
                        <Tooltip title="Pending volunteer preferences">
                            <MoreHorizIcon color="warning" fontSize="small" />
                        </Tooltip>
                    );
                } else if (params.value === null) {
                    return (
                        <Typography component="span" variant="body2"
                                    sx={{ color: 'text.disabled' }}>
                            Skip the training
                        </Typography>
                    );
                }

                const label = optionsMap.get(params.value);
                return label ?? <Typography variant="overline">[unknown]</Typography>;
            },
        },
        {
            display: 'flex',
            field: 'assignedTrainingId',
            headerName: 'Assignment',
            editable: true,
            sortable: true,
            flex: 1,

            type: 'singleSelect',
            valueOptions: props.trainings,

            renderCell: params => {
                if (params.value === undefined) {
                    return (
                        <Tooltip title="Pending approval">
                            <MoreHorizIcon color="warning" fontSize="small" />
                        </Tooltip>
                    );
                } else if (params.value === null || params.value === 0) {
                    return (
                        <Typography component="span" variant="body2"
                                    sx={{ color: 'text.disabled' }}>
                            Skip the training
                        </Typography>
                    );
                }

                const label = optionsMap.get(params.value);
                return label ?? <Typography variant="overline">[unknown]</Typography>;
            },
        },
        {
            field: 'confirmed',
            headerName: 'Confirmed',
            editable: true,
            sortable: true,
            width: 100,
            type: 'boolean',

            renderCell: params => {
                return !!params.value ? <CheckCircleIcon fontSize="small" color="success" />
                                      : <CancelIcon fontSize="small" color="error" />;
            },
        }
    ];

    return (
        <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="h5" sx={{ pb: 1 }}>
                Training assignments
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
                Preferences must be indicated by volunteers and cannot be updated here. Assignments
                will be tentative until the confirmation box is checked.
            </Alert>
            <RemoteDataTable columns={columns} endpoint="/api/admin/trainings/assignments"
                             defaultSort={{ field: 'name', sort: 'asc' }} context={context}
                             enableUpdate pageSize={100} disableFooter refreshOnUpdate />
            <Collapse in={!!props.warnings.length}>
                <Alert severity="warning" sx={{ mt: 2 }}>
                    <Stack direction="column" spacing={0} sx={{ maxWidth: '100%' }}>
                        { props.warnings.map(({ volunteer, warning }, index) =>
                            <Typography key={index} variant="body2">
                                <strong>{volunteer}</strong> {warning}
                            </Typography> )}
                    </Stack>
                </Alert>
            </Collapse>
        </Paper>
    );
}
