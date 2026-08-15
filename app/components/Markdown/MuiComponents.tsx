// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';

import Link from '@app/LinkProxy';

import type { Components } from 'rehype-react';

import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/**
 * Component variants to integrate the Markdown renderer with our use of Material UI.
 */
export const kMuiComponents: Partial<Components> = {
    // ---------------------------------------------------------------------------------------------
    // Typography components
    // ---------------------------------------------------------------------------------------------

    h1: ({ children, ...props }) =>
        <Typography variant="g5" component="h1" {...props}>
            {children}
        </Typography>,
    
    h2: ({ children, ...props }) =>
        <Typography variant="h6" component="h2" {...props}>
            {children}
        </Typography>,

    h3: ({ children, ...props }) =>
        <Typography variant="subtitle1" component="h3" {...props}>
            {children}
        </Typography>,

    h4: ({ children, ...props }) =>
        <Typography variant="subtitle2" component="h4" {...props}>
            {children}
        </Typography>,

    a: ({ children, href, ...props }) =>
        <MuiLink component={Link} href={href} {...props}>
            {children}
        </MuiLink>,

    p: ({ children, ...props }) =>
        <Typography variant="body2" component="p" {...props}>
            {children}
        </Typography>,

    code: ({ children, ...props }) =>
        <Typography variant="body2" component="code" sx={{
            fontFamily: 'monospace',
            whiteSpace: 'pre-line'
        }} {...props}>
            {children}
        </Typography>,

    // ---------------------------------------------------------------------------------------------
    // List-related components
    // ---------------------------------------------------------------------------------------------

    ol: ({ children, ...props }) =>
        <Box component="ol" {...props}>
            {children}
        </Box>,

    ul: ({ children, ...props }) =>
        <Box component="ul" {...props}>
            {children}
        </Box>,

    li: ({ children, ...props }) =>
        <Typography component="li" variant="body2" {...props}>
            {children}
        </Typography>,

};
