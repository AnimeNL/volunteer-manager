// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useFormContext } from '@proxy/react-hook-form-mui';

import MailOutlinedIcon from '@mui/icons-material/MailOutlined';

/**
 * Displays an e-mail icon whose colour responds to whether any CRUD permissions are selected for
 * the corresponding inbox field.
 */
export function InboxAccountIcon(props: { name: string }) {
    const { watch } = useFormContext();

    const value = watch(props.name);
    const active = Array.isArray(value) && value.length > 0;

    return (
        <MailOutlinedIcon
            color={ active ? 'primary' : 'disabled' }
            sx={ theme => ({
                transition: theme.transitions.create('color', {
                    duration: theme.transitions.duration.complex,
                }),
            }) } />
    );
}
