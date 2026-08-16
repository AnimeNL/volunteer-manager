// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { Cache } from '@lib/cache';
import { cyrb53 } from './cyrb53';

/**
 * Converts the given |content| to plain HTML. The |content| will be cached for a period of time to
 * avoid repeating the conversion process, which can be costly for larger amounts of content.
 */
export async function markdownToHtml(content: string): Promise<string> {
    const hash = `html-${cyrb53(content)}`;
    return await Cache.getInstance('ContentMarkdown').getOrInsert(hash, async () => {
        const file = await unified()
            .use(remarkParse)
            .use(remarkGfm)
            .use(remarkRehype)
            .use(rehypeStringify)
            .process(content);

        return String(file);

    }) as string;
}
