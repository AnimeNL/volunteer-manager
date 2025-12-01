// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import ExtensionIcon from '@mui/icons-material/Extension';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import { Publish, kSubscriptionType } from '@lib/subscriptions';
import type { TestMessage } from '@lib/subscriptions/drivers/TestDriver';

/**
 * Props accepted by the <SubscriptionTestAction> component.
 */
export type SubscriptionTestActionProps = TestMessage;

/**
 * The <SubscriptionTestAction> component displays an icon button that can be used to quickly test
 * that subscriptions are functional. A message will be published to all users who have subscribed
 * to test messages, regardless of messaging channel.
 */
export function SubscriptionTestAction(props: SubscriptionTestActionProps) {
    async function publishTestMessage(props: SubscriptionTestActionProps) {
        'use server';

        await Publish({
            type: kSubscriptionType.Test,
            sourceUserId: props.userId,
            message: props,
        });
    }

    return (
        <form action={publishTestMessage.bind(null, props)}>
            <Tooltip title="Publish a test message">
                <IconButton size="small" type="submit">
                    <ExtensionIcon fontSize="small" color="warning" />
                </IconButton>
            </Tooltip>
        </form>
    );
}
