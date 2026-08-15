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
 * Retrieves the content for the given `path`.
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

    let markdown: Content<T>['markdown'];
    if (options?.disableJsx) {
        markdown = copiedContent.content;
    } else {
        const contentVariant = options?.variant ?? 'body1';
        const contentHash = cyrb53(copiedContent.content, contentVariant === 'body1' ? 0 : 42);

        markdown = await Cache.getInstance('ContentMarkdown').getOrInsert(contentHash, async () =>
            Markdown({
                content: copiedContent.content,
                variant: options?.variant,
            })) as any;
    }

    return {
        title: copiedContent.title,
        markdown,
    };
}

/**
 * Retrieves the content for the given `path`.
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

/**
 * cyrb53 (c) 2018 bryc (Public Domain)
 * Fast, 53-bit string hash with high collision resistance.
 */
export function cyrb53(str: string, seed: number = 0): string {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;

    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    // Return as a 14-character hex string
    const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);

    return hash.toString(16).padStart(14, '0');
}
