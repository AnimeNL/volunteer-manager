// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Button from '@mui/material/Button';
import LinkIcon from '@mui/icons-material/Link';

import type { ServerAction } from '@lib/serverAction';

/**
 * Props accepted by the <ChangeSlugQuickAction> component.
 */
interface ChangeSlugQuickActionProps {
    /**
     * Server Action through which the quick action can be committed.
     */
    action: ServerAction;
}

/**
 * The <ChangeSlugQuickAction> component allows an event's slug to be updated.
 */
export function ChangeSlugQuickAction(props: ChangeSlugQuickActionProps) {
    return (
        <>
            <Button startIcon={ <LinkIcon /> } size="small" variant="outlined" color="inherit">
                Change slug
            </Button>
            { /* todo */ }
        </>
    );
}
