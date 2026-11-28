// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { revalidateTag, updateTag } from 'next/cache';

import type { InvalidationScope, ResolvedInvalidationContext } from './InvalidationScopes';

/**
 * Invalidates a single Next.js cache tag. Prefers `updateTag()` inside Server Actions for
 * read-your-own-writes consistency, falling back to `revalidateTag(tag, 'max')` in Route Handlers
 * and cleanly no-oping outside Next.js request contexts (e.g. background scheduler or unit tests).
 */
function invalidateNextCacheTag(tag: string): void {
    try {
        updateTag(tag);
        return;
    } catch {
        // `updateTag()` is only valid inside Server Actions; fall through to `revalidateTag()`.
    }

    try {
        revalidateTag(tag, 'max');
    } catch {
        // Outside a Next.js request context (e.g. background scheduler or unit tests).
    }
}

/**
 * Quarantined bridge mapping domain invalidation scopes to the narrow set of Next.js `'use cache'`
 * tags maintained for App Shell / Instant Navigation reads in `app/schedule2/`.
 */
export function invalidateNextCacheTags(
    scopes: readonly InvalidationScope[],
    context: ResolvedInvalidationContext): void
{
    const tags = new Set<string>();

    for (const scope of scopes) {
        switch (scope) {
            case 'event.identity':
                if (context.eventSlug)
                    tags.add(`schedule-metadata:event:${context.eventSlug}`);
                if (context.previousSlug)
                    tags.add(`schedule-metadata:event:${context.previousSlug}`);
                break;

            case 'event.program':
                tags.add('schedule-program');
                break;

            case 'event.content':
                if (context.contentType === 'FAQ' || context.contentType === undefined) {
                    if (context.eventId !== undefined)
                        tags.add(`schedule-knowledge:${context.eventId}`);
                    if (context.categoryId !== undefined)
                        tags.add(`schedule-metadata:category:${context.categoryId}`);
                }
                break;

            case 'team':
                if (context.teamSlug)
                    tags.add(`schedule-metadata:team:${context.teamSlug}`);
                else
                    tags.add('schedule-duty-book-teams');
                break;

            case 'team.visibility':
                tags.add('schedule-duty-book-teams');
                break;

            default:
                break;
        }
    }

    for (const tag of tags)
        invalidateNextCacheTag(tag);
}
