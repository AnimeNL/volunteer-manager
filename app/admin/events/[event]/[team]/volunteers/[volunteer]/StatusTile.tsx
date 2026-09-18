// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { Suspense } from 'react';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Props accepted by the <StatusTile> component.
 */
interface StatusTileProps {
    /**
     * URL that the icon should link to when activated by the user.
     */
    href: string;

    /**
     * Title to display on the tile.
     */
    title: string;

    /**
     * Type of status that's represented by this tile.
     */
    type: 'ticket';
}

/**
 * Tile that displays the status of one of the volunteer's preferences regarding their hotel,
 * ticket, training, refund and so on. Content will be loaded asynchronously.
 */
export function StatusTile(props: React.PropsWithChildren<StatusTileProps>) {
    return (
        <Paper sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <IconButton LinkComponent={Link} href={props.href}>
                    { props.type === 'ticket' && <LocalActivityOutlinedIcon fontSize="large" /> }
                </IconButton>
                <Divider flexItem orientation="vertical" />
                <Box>
                    <Typography variant="subtitle2">
                        {props.title}
                    </Typography>
                    <Suspense fallback={ <StatusTileLoading /> }>
                        {props.children}
                    </Suspense>
                </Box>
            </Stack>
        </Paper>
    );
}

/**
 * Component that displays a couple of loading bars indicating that status is still being determined
 */
function StatusTileLoading() {
    return (
        <Stack direction="column" spacing={0.25} sx={{ pt: 0.25 }}>
            <Skeleton animation="wave" height={6} width="88%" />
            <Skeleton animation="wave" height={6} width="92%" />
            <Skeleton animation="wave" height={6} width="85%" />
        </Stack>
    );
}
