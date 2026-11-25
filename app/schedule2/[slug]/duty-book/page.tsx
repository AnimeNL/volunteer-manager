// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { PlaceholderPage } from '../components/PlaceholderPage';

/**
 * Placeholder Duty book overview page for `app/schedule2/[slug]/duty-book`.
 */
export default function Schedule2DutyBookPage(props: PageProps<'/schedule2/[slug]/duty-book'>) {
    return <PlaceholderPage params={props.params} title="Duty book" />;
}

export const instant = true;
export const prefetch = 'partial';
