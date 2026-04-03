// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { generateScheduleMetadataFn } from '../lib/generateScheduleMetadataFn';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The <DutyBookPage> component displays an overview of the Duty Book entries, including the ability
 * to log a new entry in the Duty Book for others to be aware of.
 */
export default async function DutyBookPage(props: PageProps<'/schedule/[event]/duty-book'>) {
    const params = await props.params;
    await requireAuthenticationContext({ check: 'event', event: params.event });

    return <p>Nothing to see here yet...</p>;
}

export const generateMetadata = generateScheduleMetadataFn([ 'Duty book' ]);
