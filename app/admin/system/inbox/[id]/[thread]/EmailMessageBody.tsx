// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useRef } from 'react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useColorScheme, useTheme } from '@mui/material/styles';

/**
 * Extracts `@font-face` declarations from same-origin stylesheets in the parent document so
 * `next/font` web fonts (such as `Inter`) resolve inside the `srcDoc` iframe.
 */
function readParentFontFaceCss(): string {
    const fontRules: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
        try {
            for (const rule of Array.from(sheet.cssRules)) {
                if (rule instanceof CSSFontFaceRule)
                    fontRules.push(rule.cssText);
            }
        } catch {
            // Cross-origin stylesheets cannot be inspected; skip them.
        }
    }

    return fontRules.join('\n');
}

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
 * `<iframe>` with scripts disabled and auto-sized to their content height; plain-text bodies are
 * rendered directly as fallback.
 */
export function EmailMessageBody(props: EmailMessageBodyProps) {
    const { mode, systemMode } = useColorScheme();
    const theme = useTheme();

    const observerRef = useRef<ResizeObserver | null>(null);

    useEffect(() => {
        return () => observerRef.current?.disconnect();
    }, [ /* no deps */ ]);

    const handleLoad = useCallback((event: React.SyntheticEvent<HTMLIFrameElement>) => {
        observerRef.current?.disconnect();

        const iframe = event.currentTarget;
        const iframeDoc = iframe.contentDocument;
        const body = iframeDoc?.body;
        if (!iframeDoc || !body)
            return;

        const fontFaceCss = readParentFontFaceCss();
        if (fontFaceCss && iframeDoc.head) {
            const fontStyle = iframeDoc.createElement('style');
            fontStyle.textContent = fontFaceCss;
            iframeDoc.head.prepend(fontStyle);
        }

        const syncHeight = () => {
            const height = Math.ceil(body.getBoundingClientRect().height);
            iframe.style.height = `${height}px`;
        };

        syncHeight();
        void iframeDoc.fonts?.ready.then(syncHeight);

        const observer = new ResizeObserver(syncHeight);
        observer.observe(body);
        observerRef.current = observer;
    }, [ /* no deps */ ]);

    if (props.html?.trim()) {
        const isDark = (mode === 'system' ? systemMode : mode) === 'dark';
        const colorScheme = isDark ? 'dark' : 'light';
        const textColor = isDark ? '#ffffff' : 'rgba(0, 0, 0, 0.87)';
        const secondaryColor = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)';
        const dividerColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';

        const fontFamily = theme.typography.fontFamily ?? 'sans-serif';
        const fontSize = theme.typography.body2.fontSize ?? '0.875rem';
        const lineHeight = theme.typography.body2.lineHeight ?? 1.43;

        const srcDoc = [
            '<!doctype html>',
            '<html><head>',
            '<meta charset="utf-8">',
            '<base target="_blank">',
            '<style>',
            `html{margin:0;padding:0;background:transparent;color-scheme:${colorScheme};`,
            'overflow:hidden;}',
            `body{margin:0;padding:0;display:flow-root;background:transparent;color:${textColor};`,
            `font-family:${fontFamily};font-size:${fontSize};line-height:${lineHeight};`,
            'overflow-x:auto;overflow-wrap:anywhere;}',
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
            <Box component="iframe" onLoad={handleLoad} referrerPolicy="no-referrer"
                 sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                 srcDoc={srcDoc} title={props.title}
                 sx={{
                     backgroundColor: 'transparent',
                     border: 0,
                     colorScheme,
                     display: 'block',
                     width: '100%',
                 }} />
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
