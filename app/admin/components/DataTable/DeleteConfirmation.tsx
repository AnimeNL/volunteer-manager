// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Drawer, { drawerClasses } from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { useIsMobile } from '@app/admin/lib/useIsMobile';

/**
 * Props accepted by the <DeleteConfirmation> component.
 */
interface DeleteConfirmationProps {
    /**
     * Whether the confirmation dialog/drawer should be open.
     */
    open: boolean;

    /**
     * Callback when the confirmation has been closed.
     */
    onClose: () => void;

    /**
     * Callback when the delete action has been confirmed.
     */
    onDelete: () => Promise<void> | void;

    /**
     * Subject describing what is being deleted.
     * @default "item"
     */
    subject?: string;

    /**
     * Whether the delete action is currently loading.
     */
    loading?: boolean;
}

/**
 * Component for the desktop delete confirmation dialog.
 */
function DeleteConfirmationDialog(props: DeleteConfirmationProps) {
    const { open, onClose, onDelete, loading } = props;
    const subject = props.subject ?? 'item';

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>
                Delete this {subject}?
            </DialogTitle>
            <DialogContent>
                Are you sure that you want to remove this {subject}? This action can't be
                undone once you confirm its deletion.
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={onDelete} loading={loading} variant="contained">
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
}

/**
 * Component for the mobile delete confirmation drawer/bottom sheet.
 */
function DeleteConfirmationDrawer(props: DeleteConfirmationProps) {
    const { open, onClose, onDelete, loading } = props;
    const subject = props.subject ?? 'item';

    return (
        <StyledDrawer anchor="bottom" open={open} onClose={onClose}>
            <DrawerTitle variant="h6">
                Delete this {subject}?
            </DrawerTitle>
            <Typography variant="body2" color="text.secondary">
                Are you sure that you want to remove this {subject}? This action can't be
                undone once you confirm its deletion.
            </Typography>
            <ButtonContainer>
                <Button onClick={onDelete} loading={loading} variant="contained" color="error">
                    Delete
                </Button>
                <Button onClick={onClose} variant="text">
                    Cancel
                </Button>
            </ButtonContainer>
        </StyledDrawer>
    );
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
 * Container for the buttons available to the user, where they select what should happen.
 */
const ButtonContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(3),
}));

/**
 * The <DeleteConfirmation> component encapsulates the confirmation dialog or drawer when deleting
 * items in the admin panels. Appearance is responsive.
 */
export function DeleteConfirmation(props: DeleteConfirmationProps) {
    const isMobile = useIsMobile();
    if (isMobile)
        return <DeleteConfirmationDrawer {...props} />;

    return <DeleteConfirmationDialog {...props} />;
}
