// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { executeServerAction } from '@lib/serverAction';
import { requireVolunteerAuthentication } from '@lib/auth';
import { writeUserSetting } from '@lib/UserSettings';

/**
 * Maps expandable schedule navigation sections to their backing user settings.
 */
const kNavigationSectionSettings = {
    'duty-book': 'user-schedule-expand-duty-book',
    'events': 'user-schedule-expand-events',
} as const;

/**
 * Identifier of an expandable section in the schedule navigation menu.
 */
export type ExpandableNavigationSectionId = keyof typeof kNavigationSectionSettings;

/**
 * Zod schema describing the data accepted by `updateNavigationSectionExpanded`.
 */
const kUpdateNavigationSectionExpandedData = z.object({
    section: z.enum(
        Object.keys(kNavigationSectionSettings) as [
            ExpandableNavigationSectionId,
            ...ExpandableNavigationSectionId[],
        ]),
    expanded: z.boolean(),
});

/**
 * Server Action through which the expansion state of a schedule navigation section is persisted.
 */
export async function updateNavigationSectionExpanded(
    section: ExpandableNavigationSectionId, expanded: boolean)
{
    return executeServerAction(
        { section, expanded }, kUpdateNavigationSectionExpandedData, async (data, props) =>
    {
        await requireVolunteerAuthentication(props.authenticationContext);
        await writeUserSetting(
            props.user.id, kNavigationSectionSettings[data.section], data.expanded);

        return { success: true };
    });
}
