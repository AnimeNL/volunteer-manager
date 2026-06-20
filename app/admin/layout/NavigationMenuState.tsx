// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod';

import type { NavigationMenuId } from './NavigationMenuId';
import { executeServerAction } from '@lib/serverAction';
import { readUserSetting, writeUserSetting } from '@lib/UserSettings';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';

/**
 * The menu state is stored as a record type, where the key is the path to a particular menu item
 * such as "organisation/services", and the value is whether it's expanded or not.
 */
const kMenuStateType = z.record(z.string(), z.boolean());

/**
 * Fetches the menu state for the given `menuId` from the database.
 */
export async function fetchMenuStateFromDatabase(userId: number, menuId?: NavigationMenuId)
    : Promise<z.infer<typeof kMenuStateType>>
{
    const comprehensiveState = await readUserSetting(userId, 'user-admin-menu-state');
    let relevantState: { [k: string]: boolean } = { /* empty */ };

    try {
        const comprehensiveStateObject = JSON.parse(comprehensiveState || '{}');

        const parsedComprehensiveStateObject = kMenuStateType.safeParse(comprehensiveStateObject);
        if (parsedComprehensiveStateObject.success) {
            if (!!menuId) {
                const prefix = `${menuId}/`;
                for (const [ key, value ] of Object.entries(parsedComprehensiveStateObject.data)) {
                    if (key.startsWith(prefix))
                        relevantState[key.slice(prefix.length)] = value;
                }
            } else {
                relevantState = parsedComprehensiveStateObject.data;
            }
        }
    } catch { /* do nothing */ }

    return relevantState;
}

/**
 * Server Action through which the menu state for the given `menuId` can be updated.
 */
export async function updateMenuState(
    userId: number, menuId: NavigationMenuId, sectionId: string, expanded: boolean): Promise<void>
{
    'use server';
    await executeServerAction({ /* no data */ }, z.object(), async (data, props) => {
        executeAccessCheck(props.authenticationContext, { check: 'admin' });

        const existingState = await fetchMenuStateFromDatabase(userId);
        existingState[`${menuId}/${sectionId}`] = !!expanded;

        await writeUserSetting(userId, 'user-admin-menu-state', JSON.stringify(existingState));
    });
}
