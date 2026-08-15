// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { DocumentationContainerProps } from './DocumentationContainerProps';

/**
 * The <DocumentationDrawer> component displays the documentation in a MUI drawer that slides in
 * from the right. It is styled to have a minimum width of 400px and a maximum width of 40dvw.
 */
export function DocumentationDrawer(props: DocumentationContainerProps) {
    return (
        <Drawer anchor="right"
                open={props.open} onClose={props.onClose}
                slotProps={{ paper: { sx: { width: '40dvw' } } }}>
            <Stack direction="row" sx={{
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 2,
            }}>
                <Typography variant="h6" noWrap>
                    {props.title}
                </Typography>
                <IconButton onClick={props.onClose} aria-label="close" size="small">
                    <CloseIcon />
                </IconButton>
            </Stack>
            <Divider />
            <Stack direction="column" spacing={2} sx={{ flex: 1,  overflowY: 'auto', padding: 2 }}>
                { props.error &&
                    <Alert severity="error" variant="outlined">
                        {props.error}
                    </Alert> }
                {props.content}
            </Stack>
        </Drawer>
    );
}
