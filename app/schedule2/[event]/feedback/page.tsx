// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';

import { PlaceholderPage } from '../components/PlaceholderPage';

/**
 * Placeholder Feedback page for the schedule portal.
 */
export default function ScheduleFeedbackPage(props: PageProps<'/schedule2/[event]/feedback'>) {
    return (
        <PlaceholderPage
            description="Share feedback or report issues with the schedule portal."
            icon={ <FeedbackOutlinedIcon /> }
            params={props.params}
            title="Feedback" />
    );
}

export const instant = true;
export const prefetch = 'partial';
