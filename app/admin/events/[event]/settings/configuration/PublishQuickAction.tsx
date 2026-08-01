// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Button from '@mui/material/Button';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';

import type { ServerActionResult } from '@lib/serverAction';

/**
 * Props accepted by the <PublishQuickAction> component.
 */
interface PublishQuickActionProps {
    /**
     * Server Action through which the quick action can be committed.
     */
    action: () => Promise<ServerActionResult>;

    /**
     * Whether the event is currently suspended, which changes the polarity of this button.
     */
    suspended: boolean;
}

/**
 * The <PublishQuickAction> component allows an event to quickly be published or suspended.
 */
export function PublishQuickAction(props: PublishQuickActionProps) {
    let buttonStartIcon: React.ReactNode;
    let buttonLabel: string;

    if (props.suspended) {
        buttonStartIcon = <PlayCircleOutlinedIcon />;
        buttonLabel = 'Publish event';
    } else {
        buttonStartIcon = <StopCircleOutlinedIcon />;
        buttonLabel = 'Suspend event';
    }

    return (
        <>
            <Button startIcon={buttonStartIcon} size="small" variant="outlined" color="inherit">
                {buttonLabel}
            </Button>
            { /* todo */ }
        </>
    );
}
