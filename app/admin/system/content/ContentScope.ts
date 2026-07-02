// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ContentScope } from '@app/api/admin/content/[[...id]]/route';

import { kContentType } from '@lib/database/Types';

/**
 * Creates an event-based content scope, which is keyed by the event's ID, as well as the team's ID.
 */
export function createEventScope(eventId: number, teamId: number)
    : ContentScope
{
    return {
        eventId,
        teamId,
        type: kContentType.Page,
    };
}

/**
 * Creates a global content scope.
 */
export function createGlobalScope(): ContentScope {
    return {
        eventId: /* none= */ 0,
        teamId: /* stewards= */ 2,
        type: kContentType.Page,
    };
}

/**
 * Creates a knowledge base scope for a given `eventId`.
 */
export function createKnowledgeBaseScope(eventId: number): ContentScope {
    return {
        eventId,
        teamId: /* hosts= */ 3,
        type: kContentType.FAQ,
    };
}
