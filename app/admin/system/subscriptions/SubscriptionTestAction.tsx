// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback } from 'react';

import ExtensionIcon from '@mui/icons-material/Extension';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import type { ServerActionResult } from '@lib/serverAction';

/**
 * Props accepted by the <SubscriptionTestAction> component.
 */
interface SubscriptionTestActionProps {
    /**
     * Server Action to execute when running the test.
     */
    testFn: () => Promise<ServerActionResult>;
}

/**
 * The <SubscriptionTestAction> component displays an icon button that can be used to quickly test
 * that subscriptions are functional. A message will be published to all users who have subscribed
 * to test messages, regardless of messaging channel.
 */
export function SubscriptionTestAction(props: SubscriptionTestActionProps) {
    const handlePublish = useCallback(async () => {
        await props.testFn();
    }, [ props.testFn ]);

    return (
        <IconButton size="small" onClick={handlePublish}>
            <Tooltip title="Publish a test message">
                <ExtensionIcon fontSize="small" color="warning" />
            </Tooltip>
        </IconButton>
    );
}
