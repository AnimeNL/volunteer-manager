// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useFormContext } from '@proxy/react-hook-form-mui';

import type SvgIcon from '@mui/material/SvgIcon';

/**
 * Props accepted by the <SubscriptionTypeIcon> component.
 */
interface SubscriptionTypeIconProps {
    /**
     * Icon that should be displayed.
     */
    Icon: typeof SvgIcon;

    /**
     * Name of the field(s) that should be watched for changes in values.
     */
    name: string;
}

/**
 * The <SubscriptionTypeIcon> component displays the icon associated with a particular subscription
 * type, and subscribes to changes in the field of that type to respond to selection changes.
 */
export function SubscriptionTypeIcon(props: SubscriptionTypeIconProps) {
    const { watch } = useFormContext();

    const value = watch(props.name);
    const active = Array.isArray(value) && value.length > 0;

    return <props.Icon color={ active ? 'primary' : 'disabled' } sx={ theme => ({
        transition: theme.transitions.create('color', {
            duration: theme.transitions.duration.complex,
        }),
    }) } />;
}
