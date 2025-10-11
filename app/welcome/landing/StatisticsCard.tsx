// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

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
 * Card that links the signed in user through to the statistics page, which will tell them about the
 * multi-year statistics of the AnimeCon volunteering organisation.
 */
export function StatisticsCard() {
    return (
        <Card elevation={2}>
            <CardContent sx={{ pb: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="h5" component="p">
                        Statistics
                    </Typography>
                    <Tooltip title="Access is limited to certain volunteers">
                        <VisibilityOffIcon fontSize="small" color="disabled" />
                    </Tooltip>
                </Stack>
                <Typography variant="body2">
                    Multi-year statistics about the demographics, scope and
                    performance of the volunteering teams.
                </Typography>
            </CardContent>
            <CardActions sx={{ '& > a > :first-of-type': { px: 1 } }}>
                <Link href="/statistics" passHref>
                    <Button size="small" startIcon={ <ExitToAppIcon />}>
                        Launch
                    </Button>
                </Link>
            </CardActions>
        </Card>
    );
}
