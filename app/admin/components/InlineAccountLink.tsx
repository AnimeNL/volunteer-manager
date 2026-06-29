// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { useContext } from 'react';

import { default as MuiLink } from '@mui/material/Link';

import { AdminClientContext } from '../AdminClientContext';

/**
 * Props accepted by the <InlineAccountLink> component.
 */
interface InlineAccountLinkProps {
    /**
     * The user for whom an account link should be created.
     */
    user: {
        name: string;
        id: number;
    };
}

/**
 * Component that displays the user's name. When the signed in user has the necessary permissions to
 * visit their account page, the name will be linkified as well.
 */
export function InlineAccountLink(props: InlineAccountLinkProps) {
    const { canAccessAccounts } = useContext(AdminClientContext);
    if (!canAccessAccounts) {
        return props.user.name;
    } else {
        return (
            <MuiLink component={Link} href={`/admin/organisation/accounts/${props.user.id}`}>
                {props.user.name}
            </MuiLink>
        );
    }
}
