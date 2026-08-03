// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import Button from '@mui/material/Button';
import ReplayIcon from '@mui/icons-material/Replay';
import Tooltip from '@mui/material/Tooltip';

import type { ServerAction } from '@lib/serverAction';

/**
 * Props accepted by the <ReconsiderApplicationButton> component.
 */
interface ReconsiderApplicationButtonProps {
    /**
     * Server Action to invoke when reconsidering this application.
     */
    action: ServerAction;
}

/**
 * A button that moves a rejected application back to the pending stack.
 */
export function ReconsiderApplicationButton(props: ReconsiderApplicationButtonProps) {
    const [ loading, setLoading ] = useState<boolean>(false);

    const router = useRouter();

    const handleReconsider = useCallback(async () => {
        setLoading(true);
        try {
            const result = await props.action(new FormData);
            if (!!result.success)
                router.refresh();
        } finally {
            setLoading(false);
        }
    }, [ props.action, router ]);

    return (
        <Tooltip title="Move them back to pending">
            <Button size="small" variant="outlined" startIcon={ <ReplayIcon /> } loading={loading}
                    onClick={handleReconsider}>
                Reconsider
            </Button>
        </Tooltip>
    );
}
