// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { PlaceholderPage } from '../components/PlaceholderPage';

/**
 * Placeholder Help requests page for `app/schedule2/[slug]/help-requests`.
 */
export default function Schedule2HelpRequestsPage(
    props: PageProps<'/schedule2/[slug]/help-requests'>)
{
    return <PlaceholderPage params={props.params} title="Help requests" />;
}

export const instant = true;
export const prefetch = 'partial';
