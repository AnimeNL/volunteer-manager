// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { ViewTransition } from 'react';

/**
 * Shared directional `<ViewTransition>` wrapper for schedule pages. Participates only in explicit
 * `nav-forward` / `nav-back` transitions and stays inert for unrelated updates.
 */
export function PageTransition(props: React.PropsWithChildren) {
    return (
        <ViewTransition
            enter={{
                'nav-forward': 'schedule-nav-forward',
                'nav-back': 'schedule-nav-back',
                default: 'none',
            }}
            exit={{
                'nav-forward': 'schedule-nav-forward',
                'nav-back': 'schedule-nav-back',
                default: 'none',
            }}
            default="none">
            {props.children}
        </ViewTransition>
    );
}
