// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import SyncIcon from '@mui/icons-material/Sync';
import Tooltip from '@mui/material/Tooltip';

import type { ServerAction } from '@lib/serverAction';
import { TooltipIconWrapper } from '@components/TooltipIconWrapper';

/**
 * Props accepted by the <SynchronizeInboxAction> component.
 */
interface SynchronizeInboxActionProps {
    /**
     * Server Action through which messages in the inbox can be synchronized.
     */
    action: ServerAction;
}

/**
 * Header action that manually triggers an IMAP synchronization for the current inbox.
 */
export function SynchronizeInboxAction(props: SynchronizeInboxActionProps) {
    const { action } = props;

    const router = useRouter();

    const [ loading, setLoading ] = useState<boolean>(false);
    const [ notification, setNotification ] = useState<{
        message: string;
        severity: 'error' | 'success';
    } | undefined>();
    const [ notificationOpen, setNotificationOpen ] = useState<boolean>(false);

    const handleCloseNotification = useCallback(() => {
        setNotificationOpen(false);
    }, [ /* no deps */ ]);

    const showNotification = useCallback((message: string, severity: 'error' | 'success') => {
        setNotification({ message, severity });
        setNotificationOpen(true);
    }, [ /* no deps */ ]);

    const handleSynchronize = useCallback(async () => {
        setLoading(true);
        setNotificationOpen(false);

        try {
            const result = await action({ /* no arguments */ });
            if (result.success) {
                showNotification('Messages have been synchronised.', 'success');
                router.refresh();
            } else {
                showNotification(result.error ?? 'Unable to synchronise messages.', 'error');
            }
        } catch (error: any) {
            showNotification(error?.message || 'Unable to synchronise messages.', 'error');
        } finally {
            setLoading(false);
        }
    }, [ action, router, showNotification ]);

    return (
        <>
            <Tooltip title="Synchronise messages">
                <TooltipIconWrapper>
                    <IconButton aria-label="Synchronise messages" onClick={handleSynchronize}
                                loading={loading} size="small">
                        <SyncIcon color="primary" fontSize="small"
                                  sx={{ visibility: loading ? 'hidden' : 'visible' }} />
                    </IconButton>
                </TooltipIconWrapper>
            </Tooltip>
            <Snackbar open={notificationOpen}
                      autoHideDuration={ notification?.severity === 'error' ? 5000 : 3000 }
                      onClose={handleCloseNotification}>
                <Alert severity={ notification?.severity ?? 'info' } variant="filled"
                       onClose={handleCloseNotification}>
                    {notification?.message}
                </Alert>
            </Snackbar>
        </>
    );
}
