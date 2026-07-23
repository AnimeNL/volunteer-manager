// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Wrapper component to solve an hydration error when server-side rendered <Tooltip> components
 * contain a MUI SvgIcon as their immediate child.
 *
 * MUI's <Tooltip> component must attach hover and focus event listeners, as well as accessibility
 * attributes (such as `aria-label`) to its child element.
 *
 * When both are rendered client-side, this works well: refs fully resolve, merging all listeners
 * and attributes onto the SvgIcon element. On the server, DOM refs cannot be resolved, for which
 * the <Tooltip> falls back to a "safe" default of wrapping the icon in an auto-generated <span>
 * wrapper.
 *
 * Manually adding a (named) <span> element solves this problem, because the <Tooltip> now sees the
 * same element regardless of rendering mode used, event listeners and attributes are injected.
 */
export function TooltipIconWrapper(props: React.PropsWithChildren) {
    return <span style={{ lineHeight: 0 }}>{props.children}</span>
}
