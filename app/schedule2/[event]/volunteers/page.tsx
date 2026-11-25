// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { PlaceholderPage } from '../components/PlaceholderPage';

/**
 * Placeholder Volunteers page for `app/schedule2/[event]/volunteers`.
 */
export default function Schedule2VolunteersPage(props: PageProps<'/schedule2/[event]/volunteers'>) {
    return <PlaceholderPage params={props.params} title="Volunteers" />;
}

export const instant = true;
export const prefetch = 'partial';
