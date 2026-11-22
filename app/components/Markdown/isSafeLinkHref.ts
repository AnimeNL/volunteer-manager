// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * URL schemes permitted in rendered Markdown links.
 */
const kSafeLinkProtocols = new Set([ 'http:', 'https:', 'mailto:', 'tel:' ]);

/**
 * Returns whether the given `href` uses a safe protocol or a relative path.
 */
export function isSafeLinkHref(href?: string): boolean {
    if (!href)
        return false;

    const trimmed = href.trim();
    if (!trimmed)
        return false;

    if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\'))
        return true;

    if (trimmed.startsWith('#') || trimmed.startsWith('?') ||
        trimmed.startsWith('./') || trimmed.startsWith('../'))
    {
        return true;
    }

    try {
        const parsed = new URL(trimmed);
        return kSafeLinkProtocols.has(parsed.protocol);
    } catch {
        return false;
    }
}
