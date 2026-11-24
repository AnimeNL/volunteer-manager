// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { darken, lighten } from '@mui/material/styles';

/**
 * Manual styles that apply to the <HotelConfirmation> client component.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    confirmation: theme => ({
        borderLeft: `4px solid ${theme.palette.success.main}`,
        paddingX: 2,
        paddingY: 1,
        marginY: 2,

        borderRadius: theme.shape.borderRadius,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        backgroundColor: theme.palette.mode === 'light' ? lighten(theme.palette.success.main, .93)
                                                        : darken(theme.palette.success.main, .6),
    }),
};

/**
 * Props accepted by the <ConfirmationBox> component.
 */
interface ConfirmationBoxProps {
    /**
     * Title to display in the box.
     */
    primary: string;

    /**
     * Second line of text to display in the box.
     */
    secondary?: string;

    /**
     * Third line of text to display in the box.
     */
    tertiary?: string;
}

/**
 * The <ConfirmationBox> box displays a clear confirmation that something the volunteer has
 * requested has now been confirmed, with all key information contained therein.
 */
export function ConfirmationBox(props: ConfirmationBoxProps) {
    return (
        <Box sx={kStyles.confirmation}>
            <Typography variant="h6">
                {props.primary}
            </Typography>
            { props.secondary &&
                <Typography variant="body1">
                    {props.secondary}
                </Typography> }
            { props.tertiary &&
                <Typography variant="body1">
                    {props.tertiary}
                </Typography> }
        </Box>
    );
}
