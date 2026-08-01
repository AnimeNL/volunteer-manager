// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Button from '@mui/material/Button';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';

import type { ServerAction } from '@lib/serverAction';

/**
 * Props accepted by the <ChangeImageQuickAction> component.
 */
interface ChangeImageQuickActionProps {
    /**
     * Server Action through which the quick action can be committed.
     */
    action: ServerAction;
}

/**
 * The <ChangeImageQuickAction> component allows an event's image to be promptly replaced.
 */
export function ChangeImageQuickAction(props: ChangeImageQuickActionProps) {
    return (
        <>
            <Button startIcon={ <ImageOutlinedIcon /> } size="small" variant="outlined"
                    color="inherit">
                Change image
            </Button>
            { /* todo */ }
        </>
    );
}
