// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type React from 'react';
import Link from '@app/LinkProxy';
import { MuiMarkdown, defaultOverrides } from 'mui-markdown';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import { default as MuiLink, type LinkProps } from '@mui/material/Link';
import Typography, { type TypographyProps } from '@mui/material/Typography';

/**
 * Manual styles that apply to the <BaseMarkdown> client component.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    root: {
        '&> div >:last-child': { mb: 0 },
        '&> p:last-child': { mb: 0 },

        '& li:last-child': { mb: 2 },

        '& p': { marginBottom: 2 },

        '& .MuiAlert-root': { marginBottom: 2 },
        '& .MuiAlert-root p': {
            marginBottom: 0,
            typography: 'body2',
        },

        '& h5': { /* none yet */ },
        '& h6': { fontWeight: 800 },

        '& h2, h3': { marginBottom: 0 },

        '& h5 + p, h5 + ul': { marginTop: 0 },
        '& h6 + p, h6 + ul': { marginTop: 0 },

        '& li p': { margin: 0 },

        '& hr': { marginBottom: 2 },
    },
};

/**
 * Components for the different types of text that can be rendered as Markdown.
 */
function Text(props: TypographyProps & { tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' }) {
    switch (props.tag) {
        case 'h1':
        case 'h2':
            return <Typography {...props} variant="h5" />
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
            return <Typography {...props} variant="h6" />
    }

    return <Typography {...props} />
}

/**
 * Markdown replacement for both the native HTML <a> anchor element, as well as the Material UI
 * <Link> element, that employs NextJS routing.
 */
function LinkComponent(props: LinkProps & { children?: React.ReactNode }) {
    return <MuiLink component={Link} {...props} />;
}

/**
 * Properties accepted by the <BaseMarkdown> client-side component.
 */
export interface BaseMarkdownProps {
    /**
     * The content that should be displayed as the content of this component.
     */
    children?: string | null;

    /**
     * The default variant to apply to text, if any.
     */
    defaultVariant?: TypographyProps['variant'];

    /**
     * Additional component overrides to register.
     */
    overrides?: Record<string, any>;

    /**
     * Style overrides for the root Box component.
     */
    sx?: SxProps<Theme>;
}

/**
 * The BaseMarkdown component converts the input, supporting Markdown, to a MUI-friendly React component
 * tree that can be used in the display of content.
 */
export function BaseMarkdown(props: BaseMarkdownProps) {
    const { children, defaultVariant, overrides, sx } = props;

    return (
        <Box sx={sx}>
            <Typography component="div" sx={kStyles.root} variant={defaultVariant}>
                <MuiMarkdown overrides={{
                    ...defaultOverrides,
                    a: { component: LinkComponent },
                    blockquote: { component: Alert, props: { severity: 'warning' } },
                    h1: { component: Text, props: { tag: 'h1' } },
                    h2: { component: Text, props: { tag: 'h2' } },
                    h3: { component: Text, props: { tag: 'h3' } },
                    h4: { component: Text, props: { tag: 'h4' } },
                    h5: { component: Text, props: { tag: 'h5' } },
                    h6: { component: Text, props: { tag: 'h6' } },
                    p: { component: Text, props: { tag: 'p', variant: defaultVariant } },
                    span: { component: Text, props: { tag: 'span', variant: defaultVariant } },
                    ...overrides }}>
                    {children}
                </MuiMarkdown>
            </Typography>
        </Box>
    );
}
