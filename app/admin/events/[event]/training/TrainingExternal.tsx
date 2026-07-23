// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Alert from '@mui/material/Alert';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { PageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import type { TrainingsExtraRowModel } from '@app/api/admin/trainings/extra/[[...id]]/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';

/**
 * Props accepted by the <TrainingExternal> component.
 */
interface TrainingExternalProps {
    /**
     * Information about the event for which extra training participants are being shown.
     */
    event: PageInfo['event'];

    /**
     * The trainings that are available for the external folks to participate in.
     */
    trainings: { value: number; label: string; }[];
}

/**
 * The <TrainingExternal> component displays the extra people who may want to join in the training
 * sessions, outside of the volunteers we have within our team.
 */
export function TrainingExternal(props: TrainingExternalProps) {
    const { event } = props;

    const context = { event: event.slug };
    const columns: RemoteDataTableColumn<TrainingsExtraRowModel>[] = [
        {
            field: 'id',
            headerName: /* empty= */ '',
            sortable: false,
            width: 50,
        },
        {
            field: 'trainingExtraName',
            headerName: 'Full name',
            editable: true,
            sortable: true,
            flex: 1,
        },
        {
            field: 'trainingExtraEmail',
            headerName: 'E-mail address',
            editable: true,
            sortable: true,
            flex: 1,
        },
        {
            field: 'trainingExtraBirthdate',
            headerName: 'Birthdate',
            editable: true,
            sortable: true,
            flex: 1,

            renderCell: params => {
                return !!params.value ? Temporal.PlainDate.from(params.value).toString()
                                      : undefined;
            },
        },
        {
            field: 'preferenceTrainingId',
            headerName: 'Preference',
            editable: true,
            sortable: true,
            flex: 1,

            type: 'singleSelect',
            valueOptions: props.trainings,

            renderCell: params => {
                if (!params.row.preferenceUpdated) {
                    return (
                        <Tooltip title="Pending preferences">
                            <MoreHorizIcon color="warning" fontSize="small" />
                        </Tooltip>
                    );
                } else if (!params.row.preferenceTrainingId) {
                    return 'Skip the training';
                }

                for (const option of props.trainings) {
                    if (option.value === params.row.preferenceTrainingId)
                        return option.label;
                }

                return <Typography variant="overline">[unknown]</Typography>;
            },
        }
    ];

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ pb: 1 }}>
                Extra participants
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
                This table enables you to add people who would like to participate in the training
                sessions, but are not part of our teams.
            </Alert>
            <RemoteDataTable columns={columns} endpoint="/api/admin/trainings/extra"
                             context={context} enableCreate enableDelete enableUpdate disableFooter
                             defaultSort={{ field: 'trainingExtraName', sort: 'asc' }} />
        </Paper>
    );
}
