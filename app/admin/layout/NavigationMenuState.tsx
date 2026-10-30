// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { NavigationMenuId } from './NavigationMenuId';
import { executeServerAction } from '@lib/serverAction';
import { readUserSetting, writeUserSetting } from '@lib/UserSettings';
import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * The menu state is stored as a record type, where the key is the path to a particular menu item
 * such as "organisation/services", and the value is whether it's expanded or not.
 */
const kMenuStateType = z.record(z.string(), z.boolean());

/**
 * Zod schema describing the data accepted by `updateMenuState`.
 */
const kUpdateMenuStateData = z.object({
    menuId: z.enum([ 'events', 'organisation', 'dashboard' ]),
    sectionId: z.string().min(1).max(64),
    expanded: z.boolean(),
});

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
    menuId: NavigationMenuId, sectionId: string, expanded: boolean): Promise<void>
{
    'use server';
    await executeServerAction(
        { menuId, sectionId, expanded }, kUpdateMenuStateData, async (data, props) =>
    {
        await requireAuthentication(props.authenticationContext);

        const existingState = await fetchMenuStateFromDatabase(props.user.id);
        existingState[`${data.menuId}/${data.sectionId}`] = data.expanded;

        await writeUserSetting(
            props.user.id, 'user-admin-menu-state', JSON.stringify(existingState));

        return { success: true };
    });
}
