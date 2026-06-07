// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import EventIcon from '@mui/icons-material/Event';

import { SidebarButton } from './SidebarButton';

/**
 * The <SidebarVolunteersButton> is a component that provides access to the volunteer management
 * functionality for a particular event.
 */
export function SidebarVolunteersButton() {
    // TODO: Menu with the active events.

    return (
        <SidebarButton Icon={EventIcon} href="/admin/events" title="Volunteers" />
    );
}
