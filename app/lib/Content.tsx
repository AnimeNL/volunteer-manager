// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EnvironmentDomain } from './Environment';
import { Cache } from '@lib/cache';
import { Markdown, type MarkdownVariants } from '@components/Markdown/index';
import db, { tContent, tTeams } from './database';

/**
 * Dynamic content retrieved from the database.
 */
interface Content<DisableJsx> {
    /**
     * Title given to the content.
     */
    title: string;

    /**
     * Markdown content of the page.
     */
    markdown: DisableJsx extends true ? string : React.ReactNode;
}

/**
 * Options that can be provided when retrieving content from the database.
 */
interface ContentOptions<DisableJsx extends boolean = false> {
    /**
     * Disable transforming the Markdown into JSX?
     */
    disableJsx?: DisableJsx;

    /**
     * Substitutions to apply to the content. When used, all instances of "{key}" will be replaced
     * with the given values
     */
    substitutions?: Record<string, number | string>;

    /**
     * Base typography variant to apply.
     *
     * @default "body1"
     */
    variant?: MarkdownVariants;
}

/**
 * Fetches content from the database for the given `path`, `event` and `environmentName` tuple. Will
 * run a database query to do so. Only the latest revision of a page will be included, all else will
 * be ignored as they are no longer deemed relevant.
 *
 * @param environmentName The environment for which to fetch the content.
 * @param eventId Unique ID of the event for which content should be obtained.
 * @param path The path towards the content, relative from the /registration/slug/ root.
 * @param options Options to apply when processing this content.
 * @return Content object with the content when found, or undefined in all other cases.
 */
export async function getContent<T extends boolean = false>(
    environment: EnvironmentDomain, eventId: number, path: string[], options?: ContentOptions<T>)
        : Promise<Content<T> | undefined>
{
    const cache = Cache.getInstance('Content');
    const cacheKey = {
        environment,
        eventId,
        path: path.join('/'),
    };

    let content = cache.get(cacheKey);
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
                content: tContent.content,
            })
            .orderBy(tContent.revisionDate, 'desc')
            .limit(1)
            .executeSelectNoneOrOne();

        if (content)
            cache.set(cacheKey, content);
    }

    if (!content)
        return undefined;

    // Note: do not use |content| directly, as any applied substitutions would apply to the cached
    // representation and would thus carry forward to any future calls to `getContent()`.
    const copiedContent = structuredClone(content);

    if (!!options?.substitutions) {
        copiedContent.title = copiedContent.title.replace(/\\\{([a-z0-9_]+)\}/gi, '{$1}');
        copiedContent.content = copiedContent.content.replace(/\\\{([a-z0-9_]+)\}/gi, '{$1}');

        for (const [ key, value ] of Object.entries(options.substitutions)) {
            copiedContent.title = copiedContent.title.replaceAll(`{${key}}`, `${value}`);
            copiedContent.content = copiedContent.content.replaceAll(`{${key}}`, `${value}`);
        }
    }

    // TODO: Should we support a compiled Markdown cache at this point?

    return {
        title: copiedContent.title,
        markdown: options?.disableJsx
            ? copiedContent.content
            : <Markdown content={copiedContent.content} variant={options?.variant} /> as any,
    };
}

/**
 * Fetches the content for the given `path` from the database, which lives there orthogonal to any
 * particular environment or event.
 *
 * @param path The path towards the content, relative from the domain root.
 * @param options Options to apply when processing this content.
 * @returns Content object with the content when found, or undefined in all other cases.
 */
export async function getStaticContent<T extends boolean = false>(
    path: string[], options?: ContentOptions<T>): Promise<Content<T> | undefined>
{
    return getContent(/* environment= */ 'stewards.team', /* eventId= */ 0, path, options);
}
