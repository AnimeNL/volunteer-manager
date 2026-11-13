// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

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
    if (props.html?.trim()) {
        const srcDoc = [
            '<!doctype html>',
            '<html><head>',
            '<meta charset="utf-8">',
            '<base target="_blank">',
            '<style>',
            'html,body{margin:0;padding:12px 16px;font-family:system-ui,-apple-system,sans-serif;',
            'font-size:14px;line-height:1.5;color:#1f2937;background:#fff;overflow-wrap:anywhere;}',
            'img{max-width:100%;height:auto;}',
            'blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #e5e7eb;',
            'color:#4b5563;}',
            '</style>',
            '</head><body>',
            props.html,
            '</body></html>',
        ].join('');

        return (
            <Paper variant="outlined"
                   sx={{
                       height: 360,
                       minHeight: 160,
                       overflow: 'hidden',
                       resize: 'vertical',
                   }}>
                <Box component="iframe" referrerPolicy="no-referrer"
                     sandbox="allow-popups allow-popups-to-escape-sandbox"
                     srcDoc={srcDoc} title={props.title}
                     sx={{
                         border: 0,
                         display: 'block',
                         height: '100%',
                         width: '100%',
                     }} />
            </Paper>
        );
    }

    if (props.text?.trim()) {
        return (
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2"
                            sx={{
                                overflowWrap: 'anywhere',
                                whiteSpace: 'pre-wrap',
                            }}>
                    {props.text}
                </Typography>
            </Paper>
        );
    }

    return (
        <Typography color="text.secondary" sx={{ fontStyle: 'italic' }} variant="body2">
            This message has no content.
        </Typography>
    );
}
