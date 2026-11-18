// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import Button from '@mui/material/Button';
import RefreshIcon from '@mui/icons-material/Refresh';

import type { ServerActionResult } from '@lib/serverAction';

/**
 * Props accepted by the <RefreshButton> component.
 */
interface RefreshButtonProps {
    /**
     * Server Action to invoke when the button is clicked.
     */
    action: () => Promise<ServerActionResult>;
}

/**
 * The <RefreshButton> component renders a compact header action button that invokes a Server Action
 * and refreshes the current route when requested.
 */
export function RefreshButton(props: RefreshButtonProps) {
    const router = useRouter();
    const [ loading, setLoading ] = useState<boolean>(false);

    async function handleRefresh() {
        setLoading(true);
        try {
            const result = await props.action();
            if (result.success && result.refresh)
                router.refresh();

        } finally {
            setLoading(false);
        }
    }

    return (
        <Button size="small" startIcon={ <RefreshIcon /> } loading={loading} onClick={handleRefresh}>
            Refresh
        </Button>
    );
}
