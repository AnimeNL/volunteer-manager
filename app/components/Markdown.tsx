// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { BoxProps } from '@mui/material/Box';
import type { TypographyProps } from '@mui/material/Typography';

import { BaseMarkdown } from './BaseMarkdown';
import { RemoteContent } from './RemoteContent';

/**
 * Properties accepted by the <Markdown> client-side component.
 */
interface MarkdownProps extends BoxProps {
    /**
     * The content that should be displayed as the content of this component.
     */
    children?: string | null;

    /**
     * The default variant to apply to text, if any.
     */
    defaultVariant?: TypographyProps['variant'];
}

/**
 * The Markdown component converts the input, supporting Markdown, to a MUI-friendly React component
 * tree that can be used in the display of content.
 */
export function Markdown(props: MarkdownProps) {
    const { children, defaultVariant, ...boxProps } = props;

    return (
        <BaseMarkdown
            {...boxProps}
            defaultVariant={defaultVariant}
            overrides={{
                RemoteContent: { component: RemoteContent }
            }}
        >
            {children}
        </BaseMarkdown>
    );
}
