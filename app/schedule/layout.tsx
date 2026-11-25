// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Opt the legacy schedule subtree out of Cache Components instant-navigation validation.
 */
export const instant = false;

/**
 * Pass-through layout for the legacy `app/schedule/` subtree while `app/schedule2/` is developed
 * using Cache Components and Instant Navigation.
 */
export default function LegacyScheduleLayout(props: LayoutProps<'/schedule'>) {
    return props.children;
}
