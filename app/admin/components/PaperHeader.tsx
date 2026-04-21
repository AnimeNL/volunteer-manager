// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useState } from 'react';

import Box, { type BoxProps } from '@mui/material/Box';
import ClearIcon from '@mui/icons-material/Clear';
import DialogContentText from '@mui/material/DialogContentText';
import IconButton from '@mui/material/IconButton';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ShareIcon from '@mui/icons-material/Share';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { ConfirmationDialog } from './ConfirmationDialog';

/**
 * Props accepted by the <PaperHeaderClearButtonProps> component.
 */
interface PaperHeaderClearButtonProps {
    /**
     * Callback to invoke when this section should be cleared.
     */
    onClear?: () => Promise<true | { error: React.ReactNode }>;

    /**
     * The subject of the contents of this section.
     * @example 'Are you sure that you want to clear the {subject}'
     * @default 'section'
     */
    subject?: string;

    /**
     * Title to display in the header.
     */
    title: string;
}

/**
 * The <PaperHeaderClearButton> component displays a button through which the section can be cleared
 * after the user confirms that this indeed is their intention. Factored in a separate component to
 * avoid including a <Dialog> when no clear actions are available.
 */
function PaperHeaderClearButton(props: PaperHeaderClearButtonProps) {
    const { onClear, subject, title } = props;

    const [ confirmationOpen, setConfirmationOpen ] = useState<boolean>(false);

    return (
        <>
            <Tooltip title={`Clear the ${subject}`}>
                <IconButton onClick={ () => setConfirmationOpen(true) } size="small">
                    <ClearIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <ConfirmationDialog onClose={ () => setConfirmationOpen(false) }
                                onConfirm={onClear} title={title} open={confirmationOpen}>
                <DialogContentText>
                    Are you sure that you want to clear the {subject}? This action will permanently
                    remove the currently stored information.
                </DialogContentText>
            </ConfirmationDialog>
        </>
    );
}

/**
 * Props accepted by the <PaperHeader> component.
 */
interface PaperHeaderProps extends PaperHeaderClearButtonProps, Omit<BoxProps, 'children'> {
    /**
     * Title to display in the header.
     */
    title: string;

    /**
     * Subtitle to display in the header. Immediately adjacent to the header.
     */
    subtitle?: string;

    /**
     * The permission that access to this section is gated behind.
     */
    permission?: string;

    /**
     * Callback to invoke when this section should be exported.
     */
    onExport?: () => Promise<void> | void;
}

/**
 * The <PaperHeader> component is a generalised header section to indicate the purpose, context and
 * actions available to a particular section, hosted in the parenting <Paper> component.
 */
export const PaperHeader = styled((props: PaperHeaderProps) => {
    const { title, subtitle, permission, onClear, onExport, sx, ...containerProps } = props;
    const subject = props.subject ?? 'section';

    return (
        <Box component={Stack} direction="row" spacing={2} sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            ...sx,
        }} {...containerProps}>
            <Typography variant="h5">
                { title }
                { subtitle &&
                    <Typography component="span" variant="h5" sx={{
                        color: 'action.active',
                        paddingLeft: 1,
                    }}>
                        ({subtitle})
                    </Typography> }
            </Typography>
            { (!!permission || !!onClear || !!onExport) &&
                <Stack direction="row" spacing={1}>
                    { !!permission &&
                        <Stack component={Tooltip} sx={{ justifyContent: 'center', px: 0.5 }}
                               title="You have a permission granting you access">
                            <Box>
                                <LockOpenIcon fontSize="small" color="warning" />
                            </Box>
                        </Stack> }
                    { !!onExport &&
                        <Tooltip title="Create a data export">
                            <IconButton onClick={onExport} size="small">
                                <ShareIcon fontSize="small" />
                            </IconButton>
                        </Tooltip> }
                    { !!onClear &&
                        <PaperHeaderClearButton onClear={onClear} subject={subject}
                                                title={title} /> }
                </Stack> }
        </Box>
    );
})({ /* no styles */ });
