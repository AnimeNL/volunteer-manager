// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ValueOptions } from '@mui/x-data-grid-premium';

import SentimentDissatisfiedIcon from '@mui/icons-material/SentimentDissatisfied';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import SentimentSatisfiedIcon from '@mui/icons-material/SentimentSatisfied';
import SentimentVeryDissatisfiedIcon from '@mui/icons-material/SentimentVeryDissatisfied';
import SentimentVerySatisfiedIcon from '@mui/icons-material/SentimentVerySatisfied';
import Tooltip from '@mui/material/Tooltip';

/**
 * The base shift excitement options that can be selected.
 */
export const kExcitementOptions: ValueOptions[] = [
    { value: 0.00, id: 0.00, label: 'Really boring shifts' },
    { value: 0.25, id: 0.25, label: 'Boring shifts' },
    { value: 0.50, id: 0.50, label: 'Dull shifts' },
    { value: 0.75, id: 0.75, label: 'Nice shifts' },
    { value: 1.00, id: 1.00, label: 'Great shifts' },
];

/**
 * Props accepted by the <ExcitementIcon> component.
 */
interface ExcitementIconProps {
    /**
     * The excitement level, must be between 0 and 1.
     */
    excitement: number;
}

/**
 * The <ExcitementIcon> component returns an appropriate component visualising the excitement that
 * is indicated in the given `props`.
 */
export function ExcitementIcon(props: ExcitementIconProps) {
    const { excitement } = props;
    if (excitement <= 0.2) {
        return (
            <Tooltip title="This is a really boring shift">
                <SentimentVeryDissatisfiedIcon fontSize="small" color="error" />
            </Tooltip>
        );
    } else if (excitement <= 0.4) {
        return (
            <Tooltip title="This is a boring shift">
                <SentimentDissatisfiedIcon fontSize="small" color="error" />
            </Tooltip>
        );
    } else if (excitement <= 0.6) {
        return (
            <Tooltip title="This is a dull shift">
                <SentimentSatisfiedIcon fontSize="small" color="warning" />
            </Tooltip>
        );
    } else if (excitement <= 0.8) {
        return (
            <Tooltip title="This is a nice shift">
                <SentimentSatisfiedAltIcon fontSize="small" color="success" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="This is a great shift">
                <SentimentVerySatisfiedIcon fontSize="small" color="success" />
            </Tooltip>
        );
    }
}
