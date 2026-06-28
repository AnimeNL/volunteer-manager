// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { AccessControl } from '@lib/auth/AccessControl';
import { checkPermission, type PermissionAccessCheck } from '@lib/auth/AuthenticationContext';

import { type SectionTabContextClientProps, SectionTabContextClient } from './SectionTabContextClient';

/**
 * Props accepted by the <SectionTabContext> component.
 */
interface SectionTabContextProps {
    /**
     * Access control manager through which visibility can be determined.
     */
    access: AccessControl;

    /**
     * Tabs that should be available for the current set of pages.
     */
    tabs: (SectionTabContextClientProps['tabs'][number] & {
        /**
         * Condition that must evaluate to `true` in order for this tab to be shown.
         */
        condition?: boolean;

        /**
         * Permission that must be granted to the signed in user for this tab to be considered.
         */
        permission?: PermissionAccessCheck;

    })[];
}

/**
 * The <SectionTabContext> component represents the tabs that are available for the current set of
 * pages. It will be read by the <SectionTabs> to avoid needing repetition across pages.
 */
export function SectionTabContext(props: React.PropsWithChildren<SectionTabContextProps>) {
    const tabsForId: string[] = [ /* none yet */ ];
    const tabs = props.tabs.filter(tab => {
        if (tab.condition === false)
            return false;  // the `condition` has failed

        if (!!tab.permission && !checkPermission(props.access, tab.permission))
            return false;  // the `permission` requirement has not been met

        tabsForId.push(tab.label);
        return true;
    });

    return <SectionTabContextClient children={props.children} id={ computeTabContextId(tabsForId) }
                                    tabs={tabs} />;
}

/**
 * Function that computes the FNV-1a hash of the given |tabs|. This is not cryptographically secure
 * by any means, but that's not a property we need this ID to have. This implementation has another
 * flaw, which is that ['ab', 'c'] and ['a', 'bc'] compute to the same hash, but that too is not a
 * property that we'll be seeing in this system.
 */
function computeTabContextId(tabs: string[]): string {
    let hash = 0x811c9dc5;
    for (const tab of tabs) {
        for (let i = 0; i < tab.length; ++i) {
            hash ^= tab.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
    }

    return (hash >>> 0).toString(16);
}
