// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import SettingsIcon from '@mui/icons-material/Settings';

/**
 * The <AdminHeaderSettingsButton> component displays the signed in user's avatar, which, when
 * clicked on, opens a settings dialog that enables the user to update their configuration.
 */
export function AdminHeaderSettingsButton(props: React.PropsWithChildren) {
    const router = useRouter();

    const navigateToSettings = useCallback(() => router.push('/admin/settings'), [ router ]);

    return (
        <Badge anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} overlap="circular"
               onClick={navigateToSettings} sx={{ cursor: 'pointer' }}
               badgeContent={
                   <Avatar sx={{
                       backgroundColor: 'primary.contrastText',
                       fontSize: '14px',
                       width: '16px',
                       height: '16px',
                   }}>
                       <SettingsIcon fontSize="inherit" color="primary" />
                  </Avatar>
               }>
            {props.children}
        </Badge>
    );
}
