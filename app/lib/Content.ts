// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EnvironmentDomain } from './Environment';
import db, { tContent, tTeams } from './database';

declare namespace globalThis {
    let animeConContentCache: Map<string, Content> | undefined;
}

/**
 * Interface defining the information that will be made available for a particular piece of content
 * that can be shown on the volunteer manager.
 */
export interface Content {
    /**
     * Title of the page as it should be displayed. No length limits.
     */
    title: string;

    /**
     * Content of the page, formatted in Markdown. No length limits, but should be displayed using
     * the <Markdown> element to ensure proper display.
     */
    markdown: string;
}

/**
 * Clears the cached content cache. Should be called when the state is being invalidated.
 */
export function clearContentCache() {
    globalThis.animeConContentCache = new Map();
}

/**
 * Content substitutions that can be provided to the `getContent` functions.
 */
type ContentSubstitutions = Record<string, string>;

/**
 * Fetches content from the database for the given `path`, `event` and `environmentName` tuple. Will
 * run a database query to do so. Only the latest revision of a page will be included, all else will
 * be ignored as they are no longer deemed relevant.
 *
 * @param environmentName The environment for which to fetch the content.
 * @param eventId Unique ID of the event for which content should be obtained.
 * @param path The path towards the content, relative from the /registration/slug/ root.
 * @param substitutions Content substitutions that should be applied, if any.
 * @return Content object with the content when found, or undefined in all other cases.
 */
export async function getContent(
    environment: EnvironmentDomain, eventId: number, path: string[],
    substitutions?: ContentSubstitutions)
        : Promise<Content | undefined>
{
    globalThis.animeConContentCache ??= new Map;

    const uniqueContentKey = `${environment}-${eventId}-${path.join('/')}`;

    let content = globalThis.animeConContentCache.get(uniqueContentKey) || null;
    if (!content) {
        content = await db.selectFrom(tContent)
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tContent.teamId))
                    .and(tTeams.teamEnvironment.equals(environment))
                    .and(tTeams.teamFlagManagesContent.equals(/* true= */ 1))
            .where(tContent.eventId.equals(eventId))
                .and(tContent.contentPath.equals(path.join('/')))
                .and(tContent.revisionVisible.equals(/* true= */ 1))
            .select({
                title: tContent.contentTitle,
                markdown: tContent.content,
            })
            .orderBy(tContent.revisionDate, 'desc')
            .limit(1)
            .executeSelectNoneOrOne();

        if (!!content)
            globalThis.animeConContentCache.set(uniqueContentKey, content);
    }

    if (!content)
        return undefined;

    if (substitutions) {
        content.title = content.title.replace(/\\\{([a-z0-9_]+)\}/gi, '{$1}');
        content.markdown = content.markdown.replace(/\\\{([a-z0-9_]+)\}/gi, '{$1}');

        for (const [ key, value ] of Object.entries(substitutions)) {
            content.title = content.title.replaceAll(`{${key}}`, value);
            content.markdown = content.markdown.replaceAll(`{${key}}`, value);
        }
    }

    return content;
}

/**
 * Fetches the content for the given `path` from the database, which lives there orthogonal to any
 * particular environment or event.
 *
 * @param path The path towards the content, relative from the domain root.
 * @param substitutions Content substitutions that should be applied, if any.
 * @returns Content object with the content when found, or undefined in all other cases.
 */
export async function getStaticContent(path: string[], substitutions?: ContentSubstitutions)
    : Promise<Content | undefined>
{
    return getContent(/* environment= */ 'stewards.team', /* eventId= */ 0, path, substitutions);
}
