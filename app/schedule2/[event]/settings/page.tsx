// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { PlaceholderPage } from '../components/PlaceholderPage';

/**
 * Placeholder Settings page for `app/schedule2/[event]/settings`.
 */
export default function Schedule2SettingsPage(props: PageProps<'/schedule2/[event]/settings'>) {
    return <PlaceholderPage params={props.params} permission="event.settings" title="Settings" />;
}

export const instant = true;
export const prefetch = 'partial';
