// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';

import * as prod from 'react/jsx-runtime';

import rehypeReact from 'rehype-react';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

/**
 * Props accepted by the <Markdown> component.
 */
interface MarkdownProps {
    /**
     * The Markdown content that should be rendered in the component.
     */
    content: string;
}

/**
 * The <Markdown> component renders a given content to a JSX tree. Due to the complexity of this
 * operation (~120 KiB uncompressed JavaScript) we exclusively want to do this on the server,
 */
export async function Markdown(props: MarkdownProps) {
    const file = await unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype)
        .use(rehypeReact, {
            Fragment: prod.Fragment,
            jsx: prod.jsx,
            jsxs: prod.jsxs,
        })
        .process(props.content);
    
    return <>{file.result}</>;
}
