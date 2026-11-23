// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { TicketPage } from './TicketPage';
import { generateScheduleMetadataFn } from '../lib/generateScheduleMetadataFn';
import { requireVolunteerAuthenticationWithEvent } from '@lib/auth';

/**
 * The <ScheduleTicketPage> component displays the signed in volunteer's event ticket, including a
 * scannable QR code when one has been issued to them.
 */
export default async function ScheduleTicketPage(props: PageProps<'/schedule/[event]/ticket'>) {
    await requireVolunteerAuthenticationWithEvent(props);

    return <TicketPage />;
}

export const generateMetadata = generateScheduleMetadataFn([ 'Ticket' ]);
