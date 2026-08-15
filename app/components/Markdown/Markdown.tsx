// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';

import * as prod from 'react/jsx-runtime';

import rehypeReact from 'rehype-react';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import Stack from '@mui/material/Stack';

import type { TypographyVariant } from '@mui/material/styles';
import { kMuiComponents } from './MuiComponents';

/**
 * Base typography variants supported by the <Markdown> renderer.
 */
export type MarkdownVariants = Extract<TypographyVariant, 'body1' | 'body2'>;

/**
 * Font size mappings for the supported typography variants.
 */
const kFontSizeMapping: { [k in MarkdownVariants]: string } = {
    body1: '1rem',
    body2: '0.875rem',
};

/**
 * Props accepted by the <Markdown> component.
 */
export interface MarkdownProps {
    /**
     * The Markdown content that should be rendered in the component.
     */
    content: string;

    /**
     * Base typography variant to apply.
     * @default "body1"
     */
    variant?: MarkdownVariants;
}

/**
 * The <Markdown> component renders a given content to a JSX tree. Due to the complexity of this
 * operation (~120 KiB uncompressed JavaScript) we exclusively want to do this on the server,
 */
export async function Markdown(props: MarkdownProps) {
    const variant = props.variant ?? 'body1';
    const file = await unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype)
        .use(rehypeReact, {
            Fragment: prod.Fragment,
            components: kMuiComponents,
            jsx: prod.jsx,
            jsxs: prod.jsxs,
        })
        .process(props.content);
    
    console.log('--- [checkpoint] New Markdown pipeline used');
    return (
        <Stack direction="column" spacing={2} sx={{ fontSize: kFontSizeMapping[variant] }}>
            {file.result}
        </Stack>
    );
}
