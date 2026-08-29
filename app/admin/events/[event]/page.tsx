// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';

/**
 * Dashboard for the volunteering area of a particular event.
 */
export default async function EventVolunteersDashboard(props: PageProps<'/admin/events/[event]'>) {

    // TODO: Identity & metadata

    // TODO: Deadlines
    // TODO: Environments and teams
    // TODO: Finances
    // TODO: Hotel status
    // TODO: Recent changes
    // TODO: Recent volunteers
    // TODO: Training status

    return (
        <>
            TODO
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn({ event: 'event' });
