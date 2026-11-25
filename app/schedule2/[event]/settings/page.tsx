// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import { PlaceholderPage } from '../components/PlaceholderPage';

/**
 * Placeholder Developer settings page for the schedule portal.
 */
export default function ScheduleSettingsPage(props: PageProps<'/schedule2/[event]/settings'>) {
    return (
        <PlaceholderPage
            icon={ <SettingsOutlinedIcon /> }
            params={props.params}
            permission="event.settings"
            title="Developer settings" />
    );
}

export const instant = true;
export const prefetch = 'partial';
