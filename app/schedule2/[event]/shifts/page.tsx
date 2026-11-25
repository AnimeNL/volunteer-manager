// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { PlaceholderPage } from '../components/PlaceholderPage';

/**
 * Placeholder volunteer shifts page for `app/schedule2/[event]/shifts`.
 */
export default function Schedule2ShiftsPage(props: PageProps<'/schedule2/[event]/shifts'>) {
    return <PlaceholderPage params={props.params} title="Your schedule" />;
}

export const instant = true;
export const prefetch = 'partial';
