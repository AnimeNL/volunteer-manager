// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { ScheduleErrorCard } from './components/ScheduleErrorCard';

/**
 * Boundary rendered when an event or resource in the schedule portal cannot be found.
 */
export default function ScheduleNotFoundPage() {
    return (
        <ScheduleErrorCard
            statusCode={404}
            title="Page not found"
            description="The requested event or schedule page could not be found." />
    );
}
