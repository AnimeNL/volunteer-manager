// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import Box from '@mui/material/Box';
import CardActionArea from '@mui/material/CardActionArea';
import Divider from '@mui/material/Divider';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Props accepted by the <StatusTile> component.
 */
interface StatusTileProps {
    /**
     * URL that the tile should link to when activated by the user, if any.
     */
    href?: string;

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
 * ticket, training, refund and so on.
 */
export function StatusTile(props: React.PropsWithChildren<StatusTileProps>) {
    const content = (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', p: 1.5 }}>
            { props.type === 'ticket' &&
                <LocalActivityOutlinedIcon color="action" fontSize="large" sx={{ m: 1 }} /> }
            <Divider flexItem orientation="vertical" />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="subtitle2">
                    {props.title}
                </Typography>
                {props.children ?? <StatusTileLoading />}
            </Box>
            { !!props.href && <NavigateNextIcon color="action" /> }
        </Stack>
    );

    return (
        <Paper>
            { !!props.href &&
                <CardActionArea LinkComponent={Link} href={props.href}>
                    {content}
                </CardActionArea> }
            { !props.href && content }
        </Paper>
    );
}

/**
 * Component that displays a couple of loading bars indicating that status is still being determined
 */
function StatusTileLoading() {
    return (
        <Stack direction="column" spacing={0.25} sx={{ pt: 0.5 }}>
            <Skeleton animation="wave" height={6} width="88%" />
            <Skeleton animation="wave" height={6} width="92%" />
            <Skeleton animation="wave" height={6} width="85%" />
        </Stack>
    );
}
