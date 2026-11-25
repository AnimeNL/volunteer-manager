// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { ScheduleErrorCard } from './components/ScheduleErrorCard';

/**
 * Boundary rendered when a signed-in user lacks permission to access an `app/schedule2/` route.
 */
export default function Schedule2ForbiddenPage() {
    return (
        <ScheduleErrorCard
            statusCode={403}
            title="Access denied"
            description="Your account does not have access to this event schedule." />
    );
}
