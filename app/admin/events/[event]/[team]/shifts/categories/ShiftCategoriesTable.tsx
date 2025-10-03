// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Box from '@mui/material/Box';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FunctionsIcon from '@mui/icons-material/Functions';
import Tooltip from '@mui/material/Tooltip';

import type { EventShiftCategoriesRowModel } from '@app/api/admin/event/shifts/categories/[[...id]]/route';
import { ExcitementIcon, kExcitementOptions } from '@app/admin/components/ExcitementIcon';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { createColourInterpolator } from '@app/admin/lib/createColourInterpolator';

/**
 * Props accepted by the <ColourRangeBox> component.
 */
interface ColourRangeBoxProps {
    /**
     * The colour for which a colour range box should be shown.
     */
    colour: string;
}

/**
 * Displays a rectangular box visualising the range of colours that can be assigned given the base
 * `colour` for a given category of shifts.
 */
function ColourRangeBox(props: ColourRangeBoxProps) {
    const interpolator = createColourInterpolator(props.colour);
    const colours = [
        [   0, interpolator(0) ],
        [  33, interpolator(0.33) ],
        [  66, interpolator(0.66) ],
        [ 100, interpolator(1) ],
    ].map(([ percentage, colour ]) => `${colour} ${percentage}%`);

    return (
        <Box sx={{ background: `linear-gradient(90deg, ${colours.join(', ')})`,
                   borderRadius: 1,
                   height: '1.5em',
                   flex: 1 }} />
    );
}

/**
 * The <ShiftCategoriesTable> component displays a data table that can be used to create, delete and
 * edit shift categories. The MUI X Data Table reordering feature is used to manage the order.
 */
export function ShiftCategoriesTable() {
    const columns: RemoteDataTableColumn<EventShiftCategoriesRowModel>[] = [
        {
            field: 'id',
            headerName: /* no header= */ '',
            editable: false,
            width: 50,

            // The default shift category cannot be removed, as it's hardcoded in the source when
            // new shifts are being created. It can be freely updated, of course.
            isProtected: params => params.value === /* default= */ 1,
        },
        {
            field: 'name',
            headerName: 'Category',
            editable: true,
            flex: 1,
        },
        {
            field: 'excitement',
            display: 'flex',
            headerAlign: 'center',
            headerName: 'Default excitement',
            editable: true,
            align: 'center',
            width: 200,

            type: 'singleSelect',
            valueOptions: kExcitementOptions,

            renderCell: params =>
                <ExcitementIcon excitement={params.value} />,
        },
        {
            field: 'colour',
            display: 'flex',
            headerAlign: 'center',
            headerName: 'Colour',
            description: 'Colours that will be assigned to shifts',
            editable: true,
            align: 'center',
            width: 200,

            renderCell: params =>
                <ColourRangeBox colour={params.value} />,
        },
        {
            field: 'countContribution',
            headerAlign: 'center',
            headerName: /* no header= */ '',
            editable: true,
            align: 'center',
            width: 50,

            type: 'boolean',
            renderHeader: () =>
                <Tooltip title="Will shifts count as contributions?">
                    <FunctionsIcon fontSize="small" color="primary" />
                </Tooltip>,

            renderCell: params => {
                if (!!params.value) {
                    return (
                        <Tooltip title="Shifts count as contributions">
                            <CheckCircleIcon fontSize="small" color="success" />
                        </Tooltip>
                    );
                } else {
                    return (
                        <Tooltip title="Shifts do not count as contributions">
                            <CancelIcon fontSize="small" color="error" />
                        </Tooltip>
                    );
                }
            },
        }
    ];

    return (
        <RemoteDataTable columns={columns} endpoint="/api/admin/event/shifts/categories"
                         defaultSort={{ field: 'order', sort: 'asc' }} subject="category"
                         enableCreate enableDelete enableReorder enableUpdate pageSize={50}
                         disableFooter />
    );
}
