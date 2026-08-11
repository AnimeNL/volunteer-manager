// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

import type { DocumentationContainerProps } from './DocumentationContainerProps';
import { Markdown } from '@app/components/Markdown';

/**
 * The <DocumentationDialog> component displays the documentation in a full-screen dialog
 * suited for mobile devices. It provides two close affordances (icon and text button).
 */
export function DocumentationDialog(props: DocumentationContainerProps) {
    return (
        <Dialog fullScreen open={props.open} onClose={props.onClose}>
            <AppBar sx={{ position: 'relative' }}>
                <Toolbar>
                    <Typography sx={{ flex: 1 }} variant="h6" component="div" noWrap>
                        {props.title}
                    </Typography>
                    <IconButton color="inherit" edge="end" onClick={props.onClose}>
                        <CloseIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>
            <DialogContent sx={{ p: 3 }}>
                { props.error &&
                    <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
                        {props.error}
                    </Alert> }
                { props.content &&
                    <Markdown defaultVariant="body2">{props.content}</Markdown> }
            </DialogContent>
            <DialogActions sx={{
                borderTop: 1,
                borderColor: 'divider',
                justifyContent: 'center',
                padding: 4,
                paddingBottom: `max(env(safe-area-inset-bottom), 32px)`,
            }}>
                <Button variant="contained" onClick={props.onClose} size="small" sx={{ flex: 1 }}>
                    Close documentation
                </Button>
            </DialogActions>
        </Dialog>
    );
}
