// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { ScheduleErrorCard } from './components/ScheduleErrorCard';

/**
 * Boundary rendered when an unauthenticated visitor accesses a protected schedule route.
 */
export default function ScheduleUnauthorizedPage() {
    return (
        <ScheduleErrorCard
            statusCode={401}
            title="Sign in required"
            description="You must be signed in to access the volunteer schedule portal." />
    );
}
