// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useColorScheme, useTheme } from '@mui/material/styles';

/**
 * Props accepted by the <EmailMessageBody> component.
 */
export interface EmailMessageBodyProps {
    /**
     * HTML body of the e-mail message, if any.
     */
    html?: string;

    /**
     * Plain-text body of the e-mail message, if any.
     */
    text?: string;

    /**
     * Accessible title for the sandboxed iframe when rendering HTML content.
     */
    title: string;
}

/**
 * Renders the body of an inbound e-mail message. HTML bodies are isolated inside a sandboxed
 * `<iframe>` without scripts or origin access; plain-text bodies are rendered directly as fallback.
 */
export function EmailMessageBody(props: EmailMessageBodyProps) {
    const { mode, systemMode } = useColorScheme();
    const theme = useTheme();

    if (props.html?.trim()) {
        const isDark = (mode === 'system' ? systemMode : mode) === 'dark';
        const colorScheme = isDark ? 'dark' : 'light';
        const textColor = isDark ? '#ffffff' : 'rgba(0, 0, 0, 0.87)';
        const secondaryColor = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)';
        const dividerColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';

        const srcDoc = [
            '<!doctype html>',
            '<html><head>',
            '<meta charset="utf-8">',
            '<base target="_blank">',
            '<style>',
            `html,body{margin:0;padding:0;background:transparent;color:${textColor};`,
            `color-scheme:${colorScheme};font-family:system-ui,-apple-system,sans-serif;`,
            'font-size:14px;line-height:1.5;overflow-wrap:anywhere;}',
            `a{color:${theme.palette.primary.main};}`,
            'img{max-width:100%;height:auto;}',
            'blockquote{margin:8px 0;padding-left:12px;',
            `border-left:3px solid ${dividerColor};color:${secondaryColor};}`,
            '</style>',
            '</head><body>',
            props.html,
            '</body></html>',
        ].join('');

        return (
            <Box sx={{
                height: 360,
                minHeight: 160,
                overflow: 'hidden',
                resize: 'vertical',
            }}>
                <Box component="iframe" referrerPolicy="no-referrer"
                     sandbox="allow-popups allow-popups-to-escape-sandbox"
                     srcDoc={srcDoc} title={props.title}
                     sx={{
                         backgroundColor: 'transparent',
                         border: 0,
                         colorScheme,
                         display: 'block',
                         height: '100%',
                         width: '100%',
                     }} />
            </Box>
        );
    }

    if (props.text?.trim()) {
        return (
            <Typography variant="body2"
                        sx={{
                            overflowWrap: 'anywhere',
                            whiteSpace: 'pre-wrap',
                        }}>
                {props.text}
            </Typography>
        );
    }

    return (
        <Typography color="text.secondary" sx={{ fontStyle: 'italic' }} variant="body2">
            This message has no content.
        </Typography>
    );
}
