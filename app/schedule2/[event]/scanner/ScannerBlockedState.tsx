// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Button from '@mui/material/Button';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { IconBadge } from '../components/IconBadge';

/**
 * Props accepted by the <ScannerBlockedState> component.
 */
interface ScannerBlockedStateProps {
    description: string;
    icon: React.ReactNode;
    onPickPhoto: () => void;
    onRetry: () => void;
    title: string;
}

/**
 * Empty/blocked state shown when camera permission is declined or no camera is available.
 */
export function ScannerBlockedState(props: ScannerBlockedStateProps) {
    return (
        <Stack
            spacing={2}
            sx={{
                alignItems: 'center',
                bgcolor: 'background.default',
                borderRadius: 1,
                px: 2.5,
                py: 4,
                textAlign: 'center',
            }}>
            <IconBadge size="xl">
                {props.icon}
            </IconBadge>
            <Stack spacing={0.5} sx={{ maxWidth: 380 }}>
                <Typography variant="subtitle1">
                    {props.title}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                    {props.description}
                </Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button onClick={props.onRetry} startIcon={ <RefreshIcon /> } variant="contained">
                    Try again
                </Button>
                <Button
                    onClick={props.onPickPhoto}
                    startIcon={ <ImageOutlinedIcon /> }
                    variant="outlined">
                    Scan from photo
                </Button>
            </Stack>
        </Stack>
    );
}
