// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { PlaceholderPage } from './components/PlaceholderPage';

/**
 * Placeholder overview landing page for `app/schedule2/[event]/`.
 */
export default function Schedule2LandingPage(props: PageProps<'/schedule2/[event]'>) {
    return <PlaceholderPage params={props.params} />;
}

export const instant = true;
export const prefetch = 'partial';
