// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';

import * as prod from 'react/jsx-runtime';

import rehypeReact from 'rehype-react';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { Cache } from '@lib/cache';
import { cyrb53 } from './cyrb53';
import { remarkAdmonitionsPlugin } from './remarkAdmonitionsPlugin';

import { kMuiComponents } from './MuiComponents';

/**
 * Converts the given |content| to JSX. The |content| will be cached for a period of time to avoid
 * repeating the conversion process, which can be costly for larger amounts of content.
 */
export function markdownToJsx(content: string): React.ReactNode {
    const hash = `jsx-${cyrb53(content)}`;
    return Cache.getInstance('ContentMarkdown').getOrInsert(hash, async () => {
        const file = await unified()
            .use(remarkParse)
            .use(remarkDirective)
                .use(remarkAdmonitionsPlugin)
            .use(remarkGfm)
            .use(remarkRehype)
            .use(rehypeReact, {
                Fragment: prod.Fragment,
                components: kMuiComponents,
                jsx: prod.jsx,
                jsxs: prod.jsxs,
            })
            .process(content);
    
        return file.result;
    });
}
