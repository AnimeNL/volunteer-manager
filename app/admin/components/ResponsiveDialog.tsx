// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import React from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Drawer, { drawerClasses } from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { useIsMobile } from '@app/admin/lib/useIsMobile';

/**
 * Props accepted by the <ResponsiveDialog> component.
 */
export interface ResponsiveDialogProps<T extends React.JSXElementConstructor<any> = any> {
    /**
     * Container to display the dialog's contents in, if any.
     */
    Container?: T;

    /**
     * Props to pass to the wrapping container.
     */
    ContainerProps?: React.ComponentProps<T>;

    /**
     * Additional buttons to display on the dialog, if any.
     */
    additionalButtons?: React.ReactNode;

    /**
     * Additional content to display in the dialog, if any.
     */
    additionalContent?: React.ReactNode;

    /**
     * Label to render on the default button for closing the dialog.
     * @default "Close"
     */
    closeLabel?: string;

    /**
     * Optional description text to display.
     */
    description?: React.ReactNode;

    /**
     * Callback when the dialog/drawer is closed or cancelled.
     */
    onClose: () => void;

    /**
     * Whether the dialog/drawer should be open.
     */
    open: boolean;

    /**
     * Title of the action/dialog.
     */
    title: string;
}

/**
 * Styled drawer. Adjusted styling to behave like a Material UI bottom sheet.
 */
const StyledDrawer = styled(Drawer)(({ theme }) => ({
    [`& .${drawerClasses.paper}`]: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingLeft: theme.spacing(2),
        paddingRight: theme.spacing(2),
        paddingBottom: theme.spacing(4),
        paddingTop: theme.spacing(1),
        maxHeight: '90vh',
    },
}));

/**
 * Styled title, with amended spacing around it.
 */
const DrawerTitle = styled(Typography)(({ theme }) => ({
    margin: theme.spacing(1, 0),
    fontWeight: 'bold',
}));

/**
 * Component for the action dialog (desktop).
 */
function ResponsiveDialogDesktop(props: React.PropsWithChildren<ResponsiveDialogProps>) {
    const Container = props.Container || React.Fragment;
    return (
        <Dialog open={props.open} onClose={props.onClose} fullWidth>
            <Container {...props.ContainerProps}>
                <DialogTitle>
                    {props.title}
                </DialogTitle>
                <DialogContent>
                    <Stack direction="column" spacing={2}>
                        { !!props.description &&
                            <Typography variant="body2">
                                {props.description}
                            </Typography> }
                        {props.children}
                        {props.additionalContent}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0, pr: 3, pb: 2.5 }}>
                    <Button onClick={props.onClose} size="small">
                        { props.closeLabel || 'Close' }
                    </Button>
                    {props.additionalButtons}
                </DialogActions>
            </Container>
        </Dialog>
    );
}

/**
 * Component for the action drawer (mobile).
 */
function ResponsiveDialogMobile(props: React.PropsWithChildren<ResponsiveDialogProps>) {
    const Container = props.Container || React.Fragment;
    return (
        <StyledDrawer anchor="bottom" open={props.open} onClose={props.onClose}>
            <Container {...props.ContainerProps}>
                <DrawerTitle variant="h6">
                    {props.title}
                </DrawerTitle>
                <Stack direction="column" spacing={2}>
                    { props.description &&
                        <Typography variant="body2" color="text.secondary">
                            {props.description}
                        </Typography> }
                    {props.children}
                    {props.additionalContent}
                </Stack>
                <Stack direction="column" spacing={1} sx={{ mt: 2 }}>
                    {props.additionalButtons}
                    <Button onClick={props.onClose} size="small" variant="text">
                        { props.closeLabel || 'Close' }
                    </Button>
                </Stack>
            </Container>
        </StyledDrawer>
    );
}

/**
 * The <ResponsiveDialog> base component provides a responsive dialog (desktop) or drawer (mobile)
 * for common actions, handling titles, description text, custom children, and uniform action
 * buttons.
 */
export function ResponsiveDialog(props: React.PropsWithChildren<ResponsiveDialogProps>) {
    return useIsMobile() ? ResponsiveDialogMobile(props)
                         : ResponsiveDialogDesktop(props);
}
