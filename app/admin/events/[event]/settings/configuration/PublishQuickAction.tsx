// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import Button from '@mui/material/Button';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';

import type { ServerActionResult } from '@lib/serverAction';
import { ResponsiveConfirmationDialog } from '@app/admin/components/ResponsiveConfirmationDialog';

/**
 * Props accepted by the <PublishQuickAction> component.
 */
interface PublishQuickActionProps {
    /**
     * Server Action through which the quick action can be committed.
     */
    action: () => Promise<ServerActionResult>;

    /**
     * Whether the event is currently published, which changes the polarity of this quick action.
     */
    published: boolean;
}

/**
 * The <PublishQuickAction> component allows an event to quickly be published or suspended.
 */
export function PublishQuickAction(props: PublishQuickActionProps) {
    let buttonStartIcon: React.ReactNode;
    let buttonLabel: string;

    if (props.published) {
        buttonStartIcon = <StopCircleOutlinedIcon />;
        buttonLabel = 'Suspend event';
    } else {
        buttonStartIcon = <PlayCircleOutlinedIcon />;
        buttonLabel = 'Publish event';
    }

    const router = useRouter();

    const [ confirmationOpen, setConfirmationOpen ] = useState<boolean>(false);

    const handleConfirmationClose = useCallback(() => setConfirmationOpen(false), []);
    const handleConfirmationOpen = useCallback(() => setConfirmationOpen(true), []);

    const handleConfirmed = useCallback(async () => {
        const result = await props.action();
        if (result.success) {
            setConfirmationOpen(false);
            router.refresh();
        } else {
            throw new Error('Unable to change the status of this event.');
        }
    }, [ props.action, router ]);

    return (
        <>
            <Button startIcon={buttonStartIcon} size="small" variant="outlined" color="inherit"
                    onClick={handleConfirmationOpen}>
                {buttonLabel}
            </Button>
            <ResponsiveConfirmationDialog
                open={confirmationOpen}
                onClose={handleConfirmationClose}
                onConfirm={handleConfirmed}
                confirmColor={ props.published ? 'error' : 'success' }
                confirmLabel={ props.published ? 'Suspend' : 'Publish' }
                title={`Do you want to ${ props.published ? 'suspend' : 'publish' } this event?`}>

                { !!props.published &&
                    <>
                        Suspending this event will remove it from our websites, and any automatic
                        privileges granted to Senior and Staff volunteers will be revoked.
                    </> }

                { !props.published &&
                    <>
                        Publishing this event will make it available on our websites, and privileges
                        automatically granted to Senior and Staff volunteers will be activated.
                    </> }

            </ResponsiveConfirmationDialog>
        </>
    );
}
