// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { ViewTransition } from 'react';

/**
 * Shared directional `<ViewTransition>` wrapper for pages in `app/schedule2/[event]/`. Participates
 * only in explicit `nav-forward` / `nav-back` transitions and stays inert for unrelated updates.
 */
export function PageTransition(props: React.PropsWithChildren) {
    return (
        <ViewTransition
            enter={{
                'nav-forward': 'schedule2-nav-forward',
                'nav-back': 'schedule2-nav-back',
                default: 'none',
            }}
            exit={{
                'nav-forward': 'schedule2-nav-forward',
                'nav-back': 'schedule2-nav-back',
                default: 'none',
            }}
            default="none">
            {props.children}
        </ViewTransition>
    );
}
