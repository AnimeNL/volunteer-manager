// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DashboardCard } from '@app/admin/dashboard/DashboardCard';

/**
 * Props accepted by the <EventWarningCard> component.
 */
interface EventWarningCardProps {
    /**
     * URL to navigate to when the user clicks on the action button, if any.
     */
    href?: string;

    /**
     * Icon to display on the left-hand side of the warning card.
     */
    icon: React.ReactNode;

    /**
     * Headline title of the warning card.
     */
    title: string;
}

/**
 * Shared layout for event dashboard cards that display a warning to the user.
 */
export function EventWarningCard(props: React.PropsWithChildren<EventWarningCardProps>) {
    return (
        <DashboardCard warning>
            <Stack direction="row" spacing={1.5}
                   divider={ <Divider flexItem orientation="vertical" /> }
                   sx={{
                       alignItems: 'center',
                       px: 2,
                       py: 1.5,
                   }}>
                {props.icon}
                <Stack direction="column" sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap>
                        {props.title}
                    </Typography>
                    <Typography variant="body2">
                        {props.children}
                    </Typography>
                </Stack>
                { !!props.href &&
                    <IconButton component={Link} href={props.href}>
                        <NavigateNextIcon color="action" />
                    </IconButton> }
            </Stack>
        </DashboardCard>
    );
}
