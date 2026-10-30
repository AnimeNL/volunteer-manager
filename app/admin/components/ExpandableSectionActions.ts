// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { executeServerAction } from '@lib/serverAction';
import { requireAuthentication } from '@lib/requireAuthentication';
import { writeUserSetting } from '@lib/UserSettings';

/**
 * Boolean user settings that may be toggled by an `<ExpandableSection>`.
 */
const kExpandableSectionSettings = [
    'user-admin-event-finance-configuration',
    'user-admin-hotels-expand-history',
    'user-admin-hotels-expand-pending',
    'user-admin-knowledge-expand-categories',
    'user-admin-schedule-expand-history',
    'user-admin-schedule-expand-warnings',
    'user-admin-shifts-display-other-teams',
    'user-admin-volunteers-expand-notes',
    'user-admin-volunteers-expand-shifts',
] as const;

export type ExpandableSectionSetting = (typeof kExpandableSectionSettings)[number];

/**
 * Zod schema describing the data accepted by `updateExpandableSectionSetting`.
 */
const kUpdateExpandableSectionSettingData = z.object({
    setting: z.enum(kExpandableSectionSettings),
    expanded: z.boolean(),
});

/**
 * Server Action through which the expansion state of an `<ExpandableSection>` can be persisted.
 */
export async function updateExpandableSectionSetting(
    setting: ExpandableSectionSetting, expanded: boolean)
{
    return executeServerAction(
        { setting, expanded }, kUpdateExpandableSectionSettingData, async (data, props) =>
    {
        await requireAuthentication(props.authenticationContext);
        await writeUserSetting(props.user.id, data.setting, data.expanded);

        return { success: true };
    });
}
