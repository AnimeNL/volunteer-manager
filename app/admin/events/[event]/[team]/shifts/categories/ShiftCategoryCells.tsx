// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Box from '@mui/material/Box';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FunctionsIcon from '@mui/icons-material/Functions';
import Tooltip from '@mui/material/Tooltip';

import { createColourInterpolator } from '@app/admin/lib/createColourInterpolator';

/**
 * Cell visualising the range of colours that can be assigned given the base `colour` for a given
 * category of shifts. In mobile list view, a compact swatch is shown instead.
 */
export function ColourRangeCell(props: { listView?: boolean, row: { colour: string } }) {
    const interpolator = createColourInterpolator(props.row.colour);

    if (props.listView) {
        return (
            <Box sx={{ background: interpolator(0.5),
                       borderRadius: 1,
                       height: 24,
                       width: 24 }} />
        );
    }

    const colours = [
        [   0, interpolator(0) ],
        [  33, interpolator(0.33) ],
        [  66, interpolator(0.66) ],
        [ 100, interpolator(1) ],
    ].map(([ percentage, colour ]) => `${colour} ${percentage}%`);

    return (
        <Box sx={{ background: `linear-gradient(90deg, ${colours.join(', ')})`,
                   borderRadius: 1,
                   flex: 1,
                   height: '1.5em' }} />
    );
}

/**
 * Header component for the shift contribution column.
 */
export function ContributionHeader() {
    return (
        <Tooltip title="Will shifts count as contributions?">
            <FunctionsIcon fontSize="small" color="primary" />
        </Tooltip>
    );
}

/**
 * Cell visualising whether shifts in this category count towards someone's volunteer contribution.
 */
export function ContributionCell(props: { row: { countContribution?: boolean } }) {
    if (props.row.countContribution) {
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
}
