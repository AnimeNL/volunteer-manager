// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Element tag names inside an e-mail HTML `<body>` whose text content is metadata or styling rather
 * than visible prose.
 */
const kIgnoredTagNames = new Set([
    'HEAD',
    'LINK',
    'META',
    'NOSCRIPT',
    'SCRIPT',
    'STYLE',
    'TITLE',
]);

/**
 * Element tag names that count as visible non-text content when determining whether an e-mail body
 * has content outside a quoted section.
 */
const kVisibleMediaTagNames = new Set([ 'IMG', 'SVG', 'VIDEO' ]);

/**
 * Pattern matching plain-text reply/forward separator lines such as `-----Original Message-----`.
 */
const kPlainTextSeparatorPattern = new RegExp(
    '^-{3,}\\s*(?:original message|oorspronkelijk bericht|forwarded message|'
        + 'doorgestuurd bericht)\\s*-{3,}$',
    'i');

/**
 * CSS selector matching standard quoted/forwarded containers emitted by common e-mail clients.
 */
const kQuoteElementSelector = [
    '.gmail_quote_container',
    '.gmail_quote',
    '.gmail_extra',
    '.moz-cite-prefix',
    '.yahoo_quoted',
    '.protonmail_quote',
    '#appendonsend',
    '#divRplyFwdMsg',
    'blockquote',
].join(', ');

/**
 * Collapses non-breaking spaces and trims whitespace from `value`.
 */
function normalizeText(value: string | null | undefined): string {
    return (value ?? '').replace(/\u00a0/g, ' ').trim();
}

/**
 * Extracts visible text from `element`, inserting line breaks for `<br>`, `<p>`, and `<div>`
 * boundaries so adjacent inline runs separated by `<br>` do not merge into a single word.
 */
function extractElementText(element: HTMLElement): string {
    const parts: string[] = [];
    const visit = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.nodeValue)
                parts.push(node.nodeValue);
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE)
            return;

        const childElement = node as HTMLElement;
        if (kIgnoredTagNames.has(childElement.tagName))
            return;

        if (childElement.tagName === 'BR') {
            parts.push('\n');
            return;
        }

        for (let child = childElement.firstChild; child; child = child.nextSibling)
            visit(child);

        if (childElement.tagName === 'P' || childElement.tagName === 'DIV')
            parts.push('\n');
    };

    visit(element);
    return normalizeText(parts.join(''));
}

/**
 * Checks whether `element` is an Outlook-style reply/forward divider (`border-top` block starting
 * with `From:` / `Van:` followed by `Sent:` / `Date:` / `To:` / `Subject:`).
 */
function isOutlookReplyHeader(element: HTMLElement): boolean {
    const style = element.getAttribute('style') ?? '';
    if (!/border-top\s*:(?!\s*none)/i.test(style))
        return false;

    const text = extractElementText(element);
    return /^(?:from|van|de|von)\s*:/i.test(text)
        && /\b(?:sent|verzonden|date|datum|to|aan|subject|onderwerp)\s*:/i.test(text);
}

/**
 * Returns `true` when `root` contains any visible text or media outside `ignoredElements`.
 */
function hasMeaningfulContentOutside(
    root: HTMLElement, ignoredElements: ReadonlySet<HTMLElement>): boolean
{
    const visit = (node: Node): boolean => {
        if (node.nodeType === Node.TEXT_NODE)
            return normalizeText(node.nodeValue).length > 0;

        if (node.nodeType !== Node.ELEMENT_NODE)
            return false;

        const element = node as HTMLElement;
        if (ignoredElements.has(element) || kIgnoredTagNames.has(element.tagName))
            return false;

        if (kVisibleMediaTagNames.has(element.tagName))
            return true;

        for (let child = element.firstChild; child; child = child.nextSibling) {
            if (visit(child))
                return true;
        }

        return false;
    };

    return visit(root);
}

/**
 * Returns `true` when `body` contains any visible text or media appearing *after* `anchor` in
 * document order that is not contained within `ignoredElements`.
 */
function hasMeaningfulContentAfter(
    body: HTMLElement, anchor: HTMLElement, ignoredElements: ReadonlySet<HTMLElement>): boolean
{
    const visit = (node: Node): boolean => {
        if (node === anchor || anchor.contains(node))
            return false;

        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            if (ignoredElements.has(element) || kIgnoredTagNames.has(element.tagName))
                return false;

            const position = anchor.compareDocumentPosition(element);
            const isFollowing = (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
            if (isFollowing && !element.contains(anchor)
                && kVisibleMediaTagNames.has(element.tagName))
            {
                return true;
            }

            for (let child = element.firstChild; child; child = child.nextSibling) {
                if (visit(child))
                    return true;
            }

            return false;
        }

        if (node.nodeType === Node.TEXT_NODE) {
            if (normalizeText(node.nodeValue).length === 0)
                return false;

            return (anchor.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        }

        return false;
    };

    return visit(body);
}

/**
 * Returns `true` when `element` is a purely empty visual spacer (`<br>` or an empty `<p>` / `<div>`
 * without media or horizontal rules) that precedes a collapsed quote block.
 */
function isEmptySpacerElement(element: HTMLElement): boolean {
    if (element.tagName === 'BR')
        return true;

    if (element.tagName !== 'P' && element.tagName !== 'DIV')
        return false;

    if (element.querySelector('img, svg, video, hr'))
        return false;

    return normalizeText(element.textContent).length === 0;
}

/**
 * Identifies trailing quoted/forwarded DOM elements inside an e-mail `<body>` that can be safely
 * collapsed without hiding inline replies or leaving an empty message.
 */
export function findCollapsibleHtmlNodes(body: HTMLElement): HTMLElement[] {
    const rawSet = new Set<HTMLElement>();

    const appendOutlookDividerAndSiblings = (divider: HTMLElement) => {
        if (divider.previousElementSibling?.tagName === 'HR')
            rawSet.add(divider.previousElementSibling as HTMLElement);

        let cursor: Element | null = divider;
        while (cursor) {
            if (cursor.nodeType === Node.ELEMENT_NODE && !kIgnoredTagNames.has(cursor.tagName))
                rawSet.add(cursor as HTMLElement);
            cursor = cursor.nextElementSibling;
        }
    };

    for (const match of Array.from(body.querySelectorAll<HTMLElement>(kQuoteElementSelector))) {
        if (match.id === 'appendonsend' || match.id === 'divRplyFwdMsg')
            appendOutlookDividerAndSiblings(match);
        else
            rawSet.add(match);
    }

    for (const div of Array.from(body.querySelectorAll<HTMLElement>('div'))) {
        if (isOutlookReplyHeader(div))
            appendOutlookDividerAndSiblings(div);
    }

    if (rawSet.size === 0)
        return [];

    // Remove candidates already nested inside an outer candidate.
    let topLevel = Array.from(rawSet).filter(candidate => {
        for (const other of rawSet) {
            if (other !== candidate && other.contains(candidate))
                return false;
        }
        return true;
    });

    // Promote wrapper elements (such as Apple Mail's `<div dir="ltr"><br><blockquote ...>`) whose
    // entire content consists of candidates and whitespace.
    let promoted = true;
    while (promoted) {
        promoted = false;
        const currentSet = new Set(topLevel);
        const nextSet = new Set<HTMLElement>();

        for (const candidate of topLevel) {
            const parent = candidate.parentElement;
            if (parent && parent !== body && !hasMeaningfulContentOutside(parent, currentSet)) {
                nextSet.add(parent);
                promoted = true;
            } else {
                nextSet.add(candidate);
            }
        }

        topLevel = Array.from(nextSet).filter(candidate => {
            for (const other of nextSet) {
                if (other !== candidate && other.contains(candidate))
                    return false;
            }
            return true;
        });
    }

    topLevel.sort((lhs, rhs) =>
        (lhs.compareDocumentPosition(rhs) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);

    // Restrict to the trailing suffix of quote blocks so inline quotes followed by a reply remain
    // visible in context.
    let trailingStart = -1;
    for (let index = 0; index < topLevel.length; ++index) {
        const trailingSet = new Set(topLevel.slice(index));
        if (!hasMeaningfulContentAfter(body, topLevel[index], trailingSet)) {
            trailingStart = index;
            break;
        }
    }

    if (trailingStart === -1)
        return [];

    const trailingNodes = topLevel.slice(trailingStart);
    const trailingSet = new Set(trailingNodes);

    // Never collapse if there is no visible message content above the quoted section.
    if (!hasMeaningfulContentOutside(body, trailingSet))
        return [];

    // Include immediately preceding empty spacer blocks (`<br>`, `<p>&nbsp;</p>`) so collapsing
    // does not leave blank vertical padding at the bottom of the message.
    const leadingSpacers: HTMLElement[] = [];
    let prev = trailingNodes[0].previousSibling;
    while (prev) {
        if (prev.nodeType === Node.TEXT_NODE) {
            if (normalizeText(prev.nodeValue).length > 0)
                break;
        } else if (prev.nodeType === Node.ELEMENT_NODE) {
            const element = prev as HTMLElement;
            if (!isEmptySpacerElement(element))
                break;
            leadingSpacers.unshift(element);
        }

        prev = prev.previousSibling;
    }

    return [ ...leadingSpacers, ...trailingNodes ];
}

/**
 * Splits a plain-text e-mail body into its primary message and an optional trailing quoted or
 * forwarded section.
 */
export function splitPlainTextQuote(text: string): { mainText: string; quotedText?: string } {
    const normalized = text.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');

    let lastNonEmpty = lines.length - 1;
    while (lastNonEmpty >= 0 && lines[lastNonEmpty].trim().length === 0)
        --lastNonEmpty;

    if (lastNonEmpty <= 0)
        return { mainText: text };

    let splitIndex: number | undefined;

    // 1. Check for a trailing `>` quoted block (plus optional `On ... wrote:` attribution line).
    if (/^\s*>/.test(lines[lastNonEmpty])) {
        let quoteStart = lastNonEmpty;
        while (quoteStart > 0) {
            const prevLine = lines[quoteStart - 1];
            if (/^\s*>/.test(prevLine)) {
                --quoteStart;
                continue;
            }

            if (prevLine.trim().length === 0 && quoteStart >= 2
                && /^\s*>/.test(lines[quoteStart - 2]))
            {
                quoteStart -= 2;
                continue;
            }

            break;
        }

        let headerCursor = quoteStart - 1;
        if (headerCursor >= 0 && lines[headerCursor].trim().length === 0)
            --headerCursor;

        if (headerCursor >= 0 && /:\s*$/.test(lines[headerCursor])) {
            const headerLine = lines[headerCursor].trim();
            if (/^(?:on|op|am|le|el)\b/i.test(headerLine)
                || /\b(?:wrote|geschreven|schreef|schrieb|écrit)\s*:\s*$/i.test(headerLine))
            {
                quoteStart = headerCursor;
                if (quoteStart > 0 && !/^(?:on|op|am|le|el)\b/i.test(headerLine)
                    && /^(?:on|op|am|le|el)\b/i.test(lines[quoteStart - 1].trim()))
                {
                    --quoteStart;
                }
            }
        }

        splitIndex = quoteStart;
    }

    // 2. Otherwise check for an Outlook / forwarded plain-text header block (`-----Original
    //    Message-----` or `From: ...` followed by `Sent:` / `Date:` / `To:`).
    if (splitIndex === undefined) {
        for (let index = 1; index <= lastNonEmpty; ++index) {
            const line = lines[index].trim();
            const isDashSeparator = kPlainTextSeparatorPattern.test(line);

            const isHeaderBlock =
                /^(?:from|van|de|von)\s*:\s*\S/i.test(line)
                && index + 1 <= lastNonEmpty
                && /^(?:sent|verzonden|date|datum|to|aan)\s*:\s*\S/i.test(lines[index + 1].trim());

            if (isDashSeparator || isHeaderBlock) {
                splitIndex = index;
                break;
            }
        }
    }

    if (splitIndex === undefined)
        return { mainText: text };

    const mainText = lines.slice(0, splitIndex).join('\n').trimEnd();
    const quotedText = lines.slice(splitIndex).join('\n').trim();
    if (!mainText.trim() || !quotedText)
        return { mainText: text };

    return { mainText, quotedText };
}
