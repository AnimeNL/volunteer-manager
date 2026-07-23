// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import { TextFieldElement } from '@proxy/react-hook-form-mui';

import AddIcon from '@mui/icons-material/Add';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { ServerAction } from '@lib/serverAction';
import { ServerActionDialog } from '@app/admin/components/ServerActionDialog';

/**
 * Props accepted by the <LogFormatAction> component.
 */
interface LogFormatActionProps {
    /**
     * Server action to invoke when creating a new log format type.
     */
    createLogFormatFn: ServerAction;
}

/**
 * The <LogFormatAction> component displays a plus button in the header actions. When clicked,
 * it opens a ServerActionDialog to add a new log format type.
 */
export function LogFormatAction(props: LogFormatActionProps) {
    const [ open, setOpen ] = useState<boolean>(false);

    const handleOpen = useCallback(() => setOpen(true), []);
    const handleClose = useCallback(() => setOpen(false), []);

    return (
        <>
            <IconButton onClick={handleOpen} size="small">
                <Tooltip title="Add message format…">
                    <AddIcon fontSize="small" />
                </Tooltip>
            </IconButton>
            <ServerActionDialog action={props.createLogFormatFn} open={open} onClose={handleClose}
                                title="Add message format…" submitLabel="Add">
                <Stack direction="column" spacing={1}>
                    <Typography variant="body1" sx={{ mt: '-8px !important', pb: 1 }}>
                        Writes a new log message formatting rule to the database.
                    </Typography>
                    <TextFieldElement name="type" label="Type" size="small" fullWidth required />
                    <TextFieldElement name="format" label="Format" size="small" fullWidth
                                      required />
                </Stack>
            </ServerActionDialog>
        </>
    );
}
