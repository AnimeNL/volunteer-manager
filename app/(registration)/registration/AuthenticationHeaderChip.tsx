// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { chipClasses, default as Chip } from '@mui/material/Chip';
import { styled } from '@mui/material/styles';

import { lighten } from '@mui/material/styles';

export const AuthenticationHeaderChip = styled(Chip)(({ theme }) => {
    const chipBackground =
        theme.palette.mode === 'light' ? theme.palette.primary.main
                                       : theme.palette.theme.light;

    return {
        [`&.${chipClasses.root}`]: {
            backgroundColor: chipBackground,
            color: 'inherit',
        },
        [`&.${chipClasses.clickable}`]: {
            backgroundColor: chipBackground,
            '&:focus': {
                backgroundColor: lighten(chipBackground, 0.15),
            },
            '&:hover': {
                backgroundColor: lighten(chipBackground, 0.1),
            }
        },
        [`& .${chipClasses.avatar}`]: {
            color: 'inherit !important',
        },
        [`& .${chipClasses.icon}`]: {
            color: 'inherit !important',
        },
    };
});
