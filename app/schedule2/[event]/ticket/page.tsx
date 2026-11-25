// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';

import { PlaceholderPage } from '../components/PlaceholderPage';

/**
 * Placeholder Your ticket page for the schedule portal.
 */
export default function ScheduleTicketPage(props: PageProps<'/schedule2/[event]/ticket'>) {
    return (
        <PlaceholderPage
            description="Your festival admission barcode and ticket details."
            icon={ <ConfirmationNumberOutlinedIcon /> }
            params={props.params}
            title="Your ticket" />
    );
}

export const instant = true;
export const prefetch = 'partial';
