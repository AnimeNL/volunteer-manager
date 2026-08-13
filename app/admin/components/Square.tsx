// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

/**
 * Props accepted by the <Square> component.
 */
interface SquareProps {
    /**
     * Colour, in an HTML-renderable format, to render the square in.
     */
    colour: string;

    /**
     * Tooltip title to show when hovering over the square.
     */
    title: string;
}

/**
 * The <Square> component draws a rectangular square with a particular colour, featuring a tooltip
 * that explains what the colour is indicating.
 */
export function Square(props: SquareProps) {
    return (
        <Tooltip title={props.title}>
            <Box sx={{
                aspectRatio: 1,
                backgroundColor: props.colour,
                border: '1px solid transparent',
                borderColor: 'divider',
                borderRadius: 1,
                height: '21px',
                width: '21px',
            }} />
        </Tooltip>
    );
}
