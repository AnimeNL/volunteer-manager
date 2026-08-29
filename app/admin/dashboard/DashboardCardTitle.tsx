// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Props accepted by the <DashboardCardTitle> component.
 */
interface DashboardCardTitleProps {
    /**
     * Icon to display on the card, if any.
     */
    icon?: React.ReactNode;
}

/**
 * The <DashboardCardTitle> component displays a non-graphical title for a card.
 */
export function DashboardCardTitle(props: React.PropsWithChildren<DashboardCardTitleProps>) {
    return (
        <Stack direction="column" sx={{ paddingX: 2, paddingY: 1 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', paddingBottom: 1 }}>
                {props.icon}
                <Typography noWrap variant="h6">
                    {props.children}
                </Typography>
            </Stack>
            <Divider />
        </Stack>
    );
}
