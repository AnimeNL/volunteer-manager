// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';

import { PlaceholderPage } from '../../../components/PlaceholderPage';
import { createScheduleMetadataFn } from '../../../lib/generateScheduleMetadata';

/**
 * Placeholder ticket holders and check-in page for a program event.
 */
export default function ScheduleEventTicketsPage(
    props: PageProps<'/schedule2/[event]/events/[id]/tickets'>)
{
    return (
        <PlaceholderPage
            crudPermission="event.tickets"
            description="Ticket holders and check-in for this program event."
            icon={ <ConfirmationNumberOutlinedIcon /> }
            params={props.params}
            title="Event tickets" />
    );
}

export const generateMetadata =
    createScheduleMetadataFn('Tickets', { activity: 'id' }, 'Events', { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
