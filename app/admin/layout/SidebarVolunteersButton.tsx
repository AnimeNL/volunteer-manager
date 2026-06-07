// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback } from 'react';

import GroupsIcon from '@mui/icons-material/Groups';

import { SidebarButton } from './SidebarButton';

/**
 * The <SidebarVolunteersButton> is a component that provides access to the volunteer management
 * functionality for a particular event.
 */
export function SidebarVolunteersButton() {
    const handleMenuOpen = useCallback(() => {
        // TODO: Menu with the active events.
    }, [ /* no deps */ ]);

    return (
        <SidebarButton Icon={GroupsIcon} onClick={handleMenuOpen} title="Volunteers" />
    );
}
