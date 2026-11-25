// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';

import { PlaceholderPage } from './components/PlaceholderPage';

/**
 * Placeholder overview landing page for the event schedule portal.
 */
export default function ScheduleLandingPage(props: PageProps<'/schedule2/[event]'>) {
    return (
        <PlaceholderPage
            description="Your personal overview for the weekend."
            icon={ <HomeOutlinedIcon /> }
            params={props.params} />
    );
}

export const instant = true;
export const prefetch = 'partial';
