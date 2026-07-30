// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import Tooltip from '@mui/material/Tooltip';

/**
 * Props accepted by the <RefreshCacheAction> component.
 */
interface RefreshCacheActionProps {
    /**
     * Server Action using which the cache can be refreshed.
     */
    action: () => Promise<{ success: boolean }>;
}

/**
 * The <RefreshCacheAction> component displays a refresh icon button in the section header. Clicking
 * it will clear the EventTicketTypes cache on the server, and refresh the current page's data.
 */
export function RefreshCacheAction(props: RefreshCacheActionProps) {
    const router = useRouter();

    const [ isPending, startTransition ] = useTransition();

    const handleRefresh = useCallback(() => {
        startTransition(async () => {
            const result = await props.action();
            if (result.success)
                router.refresh();
        });
    }, [ props.action, router ]);

    return (
        <Tooltip title="Refresh ticket types">
            <span>
                <IconButton onClick={handleRefresh} disabled={isPending} size="small">
                    <RefreshIcon fontSize="small" />
                </IconButton>
            </span>
        </Tooltip>
    );
}
