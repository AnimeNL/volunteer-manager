// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

/**
 * Card that links the signed in user through to the administration area, to which they have access
 * for at least a single event. Expected to be placed as part of a grid.
 */
export function AdministrationCard() {
    return (
        <Card elevation={2}>
            <CardContent sx={{ pb: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="h5" component="p">
                        Administration
                    </Typography>
                    <Tooltip title="Access is limited to certain volunteers">
                        <VisibilityOffIcon fontSize="small" color="disabled" />
                    </Tooltip>
                </Stack>
                <Typography variant="body2">
                    Access to the administration area where we manage the events,
                    volunteers and scheduling.
                </Typography>
            </CardContent>
            <CardActions sx={{ '& > a > :first-of-type': { px: 1 } }}>
                <Link href="/admin" passHref>
                    <Button size="small" startIcon={ <ExitToAppIcon />}>
                        Launch
                    </Button>
                </Link>
            </CardActions>
        </Card>
    );
}
