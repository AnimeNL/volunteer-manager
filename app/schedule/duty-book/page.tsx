// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { redirect } from 'next/navigation';

/**
 * The <EventlessDutyBookPage> component redirects the user back to the homepage. We can deal with
 * Duty Book reports, but the report ID needs to be known.
 */
export default async function EventlessDutyBookPage() {
    redirect('/');
}
