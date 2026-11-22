// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { ReactNode, SyntheticEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Theme } from '@mui/material/styles';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useColorScheme, useTheme } from '@mui/material/styles';

import { findCollapsibleHtmlNodes, splitPlainTextQuote } from './emailQuoteCollapse';

/**
 * Toggles the `[data-email-quote-collapsed]` attribute on collapsible quote elements inside the
 * sandboxed e-mail iframe.
 */
function applyHtmlQuoteVisibility(nodes: HTMLElement[], visible: boolean): void {
    for (const node of nodes) {
        if (visible)
            delete node.dataset.emailQuoteCollapsed;
        else
            node.dataset.emailQuoteCollapsed = 'true';
    }
}

/**
 * Formats a byte size into a compact human-readable binary unit (`B`, `KiB`, or `MiB`).
 */
function formatFileSize(bytes: number): string {
    if (bytes < 1024)
        return `${bytes} B`;

    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KiB`;

    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/**
 * Extracts `@font-face` declarations from same-origin stylesheets in the parent document so
 * `next/font` web fonts (such as `Inter`) resolve inside the `srcDoc` iframe.
 */
function readParentFontFaceCss(): string {
    const fontRules: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
        try {
            for (const rule of Array.from(sheet.cssRules)) {
                if (!(rule instanceof CSSFontFaceRule))
                    continue;

                const cssText = sheet.href
                    ? rule.cssText.replace(/url\(["']?([^"')]+)["']?\)/g, (_, url: string) =>
                        `url("${new URL(url, sheet.href!).href}")`)
                    : rule.cssText;

                fontRules.push(cssText);
            }
        } catch {
            // Cross-origin stylesheets cannot be inspected; skip them.
        }
    }

    return fontRules.join('\n');
}

/**
 * Restrictive Content-Security-Policy applied inside the sandboxed e-mail `<iframe>`.
 */
const kEmailIframeCsp = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    "font-src 'self' data:",
    'img-src https: http: data:',
    "base-uri 'none'",
    "form-action 'none'",
].join('; ');

/**
 * Strips high-risk HTML elements (`<script>`, `<iframe>`, `<object>`, `<embed>`, `<meta>`,
 * `<base>`, `<link>`) from untrusted inbound e-mail HTML before placing it into `srcDoc`.
 */
function sanitizeEmailHtml(html: string): string {
    return html
        .replace(/<(script|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<(script|iframe|object|embed|meta|base|link)\b[^>]*\/?>/gi, '');
}

/**
 * Builds the `srcDoc` HTML document used to render `html` inside a sandboxed `<iframe>`, matching
 * the active light or dark palette and typography of the admin interface.
 */
function buildEmailSrcDoc(html: string, isDark: boolean, theme: Theme): string {
    const colorScheme = isDark ? 'dark' : 'light';
    const textColor = isDark ? '#ffffff' : 'rgba(0, 0, 0, 0.87)';
    const secondaryColor = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)';
    const dividerColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';

    const fontFamily = theme.typography.fontFamily ?? 'sans-serif';
    const fontSize = theme.typography.body2.fontSize ?? '0.875rem';
    const lineHeight = theme.typography.body2.lineHeight ?? 1.43;

    return [
        '<!doctype html><html><head><meta charset="utf-8">',
        '<meta name="referrer" content="no-referrer">',
        `<meta http-equiv="Content-Security-Policy" content="${kEmailIframeCsp}">`,
        '<base target="_blank"><style>',
        `html{margin:0;padding:0;background:transparent;color-scheme:${colorScheme};`,
        'overflow:hidden;}',
        `body{margin:0;padding:0;display:flow-root;background:transparent;color:${textColor};`,
        `font-family:${fontFamily};font-size:${fontSize};line-height:${lineHeight};`,
        'overflow-x:auto;overflow-wrap:anywhere;}',
        `a{color:${theme.palette.primary.main};}`,
        'img{max-width:100%;height:auto;}',
        'blockquote{margin:8px 0;padding-left:12px;',
        `border-left:3px solid ${dividerColor};color:${secondaryColor};}`,
        '[data-email-quote-collapsed="true"]{display:none!important;}',
        '</style></head><body>',
        sanitizeEmailHtml(html),
        '</body></html>',
    ].join('');
}

/**
 * Describes an attachment associated with an inbound e-mail message.
 */
export interface EmailMessageAttachment {
    /**
     * Download URL for the attachment, omitted when the binary payload is unavailable.
     */
    downloadUrl?: string;

    /**
     * Display filename of the attachment.
     */
    filename: string;

    /**
     * Unique ID of the attachment (`inbox_email_attachments.inbox_attachment_id`).
     */
    id: number;

    /**
     * Size of the attachment in bytes.
     */
    size: number;
}

/**
 * Props accepted by the <EmailMessageBody> component.
 */
export interface EmailMessageBodyProps {
    /**
     * Attachments included with the e-mail message, if any.
     */
    attachments?: EmailMessageAttachment[];

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
 * Renders the body and attachments of an inbound e-mail message. HTML bodies are isolated inside a
 * sandboxed `<iframe>` with scripts disabled and auto-sized to their content height; plain-text
 * bodies are rendered directly as fallback. Trailing quoted sections are collapsed by default.
 */
export function EmailMessageBody(props: EmailMessageBodyProps) {
    const { mode, systemMode } = useColorScheme();
    const theme = useTheme();

    const [ hasHtmlQuote, setHasHtmlQuote ] = useState(false);
    const [ showQuoted, setShowQuoted ] = useState(false);

    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const observerRef = useRef<ResizeObserver | null>(null);
    const quotedNodesRef = useRef<HTMLElement[]>([]);
    const showQuotedRef = useRef(showQuoted);
    showQuotedRef.current = showQuoted;

    useEffect(() => {
        return () => observerRef.current?.disconnect();
    }, [ /* no deps */ ]);

    const handleLoad = useCallback((event: SyntheticEvent<HTMLIFrameElement>) => {
        observerRef.current?.disconnect();

        const iframe = event.currentTarget;
        iframeRef.current = iframe;

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

        const collapsibleNodes = findCollapsibleHtmlNodes(body);
        quotedNodesRef.current = collapsibleNodes;
        setHasHtmlQuote(collapsibleNodes.length > 0);
        applyHtmlQuoteVisibility(collapsibleNodes, showQuotedRef.current);

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

    const handleToggleQuoted = useCallback(() => {
        setShowQuoted(previous => {
            const next = !previous;
            showQuotedRef.current = next;
            applyHtmlQuoteVisibility(quotedNodesRef.current, next);

            const body = iframeRef.current?.contentDocument?.body;
            if (iframeRef.current && body) {
                const height = Math.ceil(body.getBoundingClientRect().height);
                iframeRef.current.style.height = `${height}px`;
            }

            return next;
        });
    }, [ /* no deps */ ]);

    const hasHtmlBody = !!props.html?.trim();
    const isDark = (mode === 'system' ? systemMode : mode) === 'dark';

    const srcDoc = useMemo(
        () => (hasHtmlBody ? buildEmailSrcDoc(props.html!, isDark, theme) : ''),
        [ hasHtmlBody, isDark, props.html, theme ]);

    const plainTextParts = useMemo(
        () => (!hasHtmlBody && props.text?.trim() ? splitPlainTextQuote(props.text) : undefined),
        [ hasHtmlBody, props.text ]);

    let content: ReactNode;
    if (hasHtmlBody) {
        content = (
            <Box component="iframe" onLoad={handleLoad} referrerPolicy="no-referrer"
                 sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                 srcDoc={srcDoc} title={props.title}
                 sx={{
                     backgroundColor: 'transparent',
                     border: 0,
                     colorScheme: isDark ? 'dark' : 'light',
                     display: 'block',
                     width: '100%',
                 }} />
        );
    } else if (plainTextParts) {
        const displayedText = showQuoted && plainTextParts.quotedText
            ? `${plainTextParts.mainText}\n\n${plainTextParts.quotedText}`
            : plainTextParts.mainText;

        content = (
            <Typography variant="body2"
                        sx={{
                            overflowWrap: 'anywhere',
                            whiteSpace: 'pre-wrap',
                        }}>
                {displayedText}
            </Typography>
        );
    } else {
        content = (
            <Typography color="text.secondary" sx={{ fontStyle: 'italic' }} variant="body2">
                This message has no content.
            </Typography>
        );
    }

    const hasQuotedSection = hasHtmlBody ? hasHtmlQuote : !!plainTextParts?.quotedText;
    const hasAttachments = !!props.attachments?.length;

    if (!hasQuotedSection && !hasAttachments)
        return content;

    return (
        <Stack spacing={1.5}>
            {content}
            { hasQuotedSection &&
                <Box>
                    <Chip clickable icon={ <MoreHorizIcon /> }
                          label={ showQuoted ? 'Hide quoted text' : 'Show quoted text' }
                          onClick={handleToggleQuoted} size="small"
                          sx={{ color: 'text.secondary' }} variant="outlined" />
                </Box> }
            { hasAttachments &&
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
                    { props.attachments!.map(attachment => {
                        const label =
                            `${attachment.filename} (${formatFileSize(attachment.size)})`;

                        if (!attachment.downloadUrl) {
                            return (
                                <Chip disabled icon={ <AttachFileOutlinedIcon /> }
                                      key={attachment.id} label={`${label} — unavailable`}
                                      size="small" variant="outlined" />
                            );
                        }

                        return (
                            <Chip clickable component="a" href={attachment.downloadUrl}
                                  icon={ <AttachFileOutlinedIcon /> } key={attachment.id}
                                  label={label} size="small" variant="outlined" />
                        );
                    }) }
                </Stack> }
        </Stack>
    );
}
