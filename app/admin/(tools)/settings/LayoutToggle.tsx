// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useContext } from 'react';

import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import type { ServerAction } from '@lib/serverAction';
import { AdminClientContext } from '@app/admin/AdminClientContext';

/**
 * Props accepted by the <LayoutToggle> component.
 */
interface LayoutToggleProps {
    /**
     * Server Action through which the chosen layout can be amended.
     */
    action: ServerAction<{ optIn: boolean }>;
}

/**
 * Component that enables the user to switch between the old and new layouts seamlessly.
 */
export function LayoutToggle(props: LayoutToggleProps) {
    const { isLayoutV2 } = useContext(AdminClientContext);

    const handleChangeOptInState = useCallback(async () => {
        await props.action({ optIn: !isLayoutV2 });

        // Perform a hard refresh rather than a soft refresh to update the full layout state:
        document.location.reload();

    }, [ isLayoutV2, props.action ]);

    return (
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Stack direction="column" spacing={0.5} sx={{ flex: 1 }}>
                <Typography variant="subtitle2" noWrap>
                    Opt-in to the experimental layout?
                </Typography>
                <Typography variant="body2">
                    The experimental layout enables the Volunteer Manager on mobile devices, and
                    comes with built-in support for dark mode. It's functionally complete, but may
                    still contain some rough edges!
                </Typography>
            </Stack>
            <Switch onChange={handleChangeOptInState} checked={isLayoutV2} />
        </Stack>
    );
}
