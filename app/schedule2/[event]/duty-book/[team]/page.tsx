// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import BookOutlinedIcon from '@mui/icons-material/BookOutlined';

import { PlaceholderPage } from '../../components/PlaceholderPage';

/**
 * Placeholder team Duty book page for the schedule portal.
 */
export default function ScheduleDutyBookTeamPage(
    props: PageProps<'/schedule2/[event]/duty-book/[team]'>)
{
    return (
        <PlaceholderPage
            description="Incident logs and operational notes for this team."
            icon={ <BookOutlinedIcon /> }
            params={props.params}
            title="Duty book" />
    );
}

export const instant = true;
export const prefetch = 'partial';
