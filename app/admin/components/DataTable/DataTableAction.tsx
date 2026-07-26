// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { FormContainer } from '@proxy/react-hook-form-mui';
import { useForm } from '@proxy/react-hook-form-mui';

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
 * Props accepted by the <DataTableAction> component.
 */
export interface DataTableActionProps {
    /**
     * Whether the dialog/drawer should be open.
     */
    open: boolean;

    /**
     * Callback when the dialog/drawer is closed or cancelled.
     */
    onClose: () => void;

    /**
     * Title of the action.
     */
    title: string;

    /**
     * Optional description text to display.
     */
    description?: string;

    /**
     * Custom confirm button element.
     */
    confirm: React.ReactNode;

    /**
     * Optional form context when the dialog/drawer encapsulates a form.
     */
    formContext: any;

    /**
     * Optional callback for form submission, required if formContext is provided.
     */
    onSubmit?: (data: any) => Promise<void> | void;

    /**
     * Optional children containing custom content (e.g. form fields).
     */
    children?: React.ReactNode;
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
function DataTableActionDialog(props: DataTableActionProps) {
    const { open, onClose, title, description, confirm, onSubmit, children } = props;

    // biome-ignore lint/correctness/useHookAtTopLevel: fixed, well defined usage:
    const formContext = props.formContext ?? useForm();

    const content = (
        <>
            <DialogTitle>
                {title}
            </DialogTitle>
            <DialogContent>
                {description && (
                    <Typography variant="body2" sx={{ mb: children ? 2 : 0 }}>
                        {description}
                    </Typography>
                )}
                {children}
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
                <Button onClick={onClose}>Cancel</Button>
                {confirm}
            </DialogActions>
        </>
    );

    return (
        <Dialog open={open} onClose={onClose} fullWidth>
            <FormContainer formContext={formContext} onSuccess={onSubmit}>
                {content}
            </FormContainer>
        </Dialog>
    );
}

/**
 * Component for the action drawer (mobile).
 */
function DataTableActionDrawer(props: DataTableActionProps) {
    const { open, onClose, title, description, confirm, onSubmit, children } = props;

    // biome-ignore lint/correctness/useHookAtTopLevel: fixed, well defined usage:
    const formContext = props.formContext ?? useForm();

    const content = (
        <>
            <DrawerTitle variant="h6">
                {title}
            </DrawerTitle>
            {description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: children ? 2 : 0 }}>
                    {description}
                </Typography>
            )}
            {children}
            <Stack direction="column" spacing={1} sx={{ mt: 2 }}>
                {confirm}
                <Button onClick={onClose} variant="text">
                    Cancel
                </Button>
            </Stack>
        </>
    );

    return (
        <StyledDrawer anchor="bottom" open={open} onClose={onClose}>
            <FormContainer formContext={formContext} onSuccess={onSubmit}>
                {content}
            </FormContainer>
        </StyledDrawer>
    );
}

/**
 * The <DataTableAction> base component provides a responsive dialog (desktop) or drawer (mobile)
 * for common table actions, handling titles, description text, custom children, and uniform action buttons.
 */
export function DataTableAction(props: DataTableActionProps) {
    const isMobile = useIsMobile();
    return isMobile ? <DataTableActionDrawer {...props} />
                    : <DataTableActionDialog {...props} />;
}
