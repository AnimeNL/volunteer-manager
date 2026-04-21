// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import IconButton from '@mui/material/IconButton';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Props accepted by the <ListViewCell> component.
 */
interface ListViewCellProps {
    /**
     * Avatar to display on the left-hand side of the cell. 
     */
    avatar?: React.ReactNode;

    /**
     * Link to navigate to when this list cell has been activated by the user.
     */
    href?: string;

    /**
     * Icon to display on the left-hand side of the cell.
     */
    icon?: React.ReactNode;

    /**
     * Primary text to display in the cell.
     */
    primary: React.ReactNode;

    /**
     * Secondary text to display in the cell, in a more subtle colour.
     */
    secondary?: React.ReactNode;
}

/**
 * The <ListViewCell> component is a composable button optimised for use in a MUI DataGrid when
 * displayed on a mobile device. It roughly follows the design ideas of the <ListItem> component.
 */
export function ListViewCell(props: ListViewCellProps) {
    const router = useRouter();

    const handleClick = useCallback(() => {
        if (!!props.href)
            router.push(props.href);

    }, [ props.href, router ]);

    return (
        <Stack direction="row" onClick={handleClick} spacing={2} sx={{
            alignItems: 'center',
            height: '64px',
            marginX: '-8px !important',
            paddingX: '8px',
        }}>
            {props.avatar}
            {props.icon}
            <Stack direction="column" sx={{ flexGrow: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {props.primary}
                </Typography>
                { !!props.secondary &&
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {props.secondary}
                    </Typography> }
            </Stack>
            { !!props.href &&
                <IconButton LinkComponent={Link} href={props.href}>
                    <NavigateNextIcon />
                </IconButton> }
        </Stack>
    );
}
