// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { PlaceholderPage } from '../components/PlaceholderPage';

/**
 * Placeholder program areas page for `app/schedule2/[event]/areas`.
 */
export default function Schedule2AreasPage(props: PageProps<'/schedule2/[event]/areas'>) {
    return <PlaceholderPage params={props.params} title="Events" />;
}

export const instant = true;
export const prefetch = 'partial';
