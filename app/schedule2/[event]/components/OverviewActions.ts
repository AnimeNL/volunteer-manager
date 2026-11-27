// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { executeServerAction } from '@lib/serverAction';
import { requireVolunteerAuthentication } from '@lib/auth';
import { writeUserSetting } from '@lib/UserSettings';

/**
 * Maps dismissible overview action tiles to their backing user settings.
 */
const kOverviewActionTileSettings = {
    hotel: 'user-schedule-hide-hotel-tile',
    ticket: 'user-schedule-hide-ticket-tile',
} as const;

/**
 * Identifier of a dismissible action tile on the schedule overview page.
 */
export type DismissibleOverviewActionTileId = keyof typeof kOverviewActionTileSettings;

/**
 * Zod schema describing the data accepted by `dismissOverviewActionTile`.
 */
const kDismissOverviewActionTileData = z.object({
    tile: z.enum([ 'hotel', 'ticket' ]),
});

/**
 * Server Action persisting dismissal of a single overview action tile for the signed-in volunteer.
 */
export async function dismissOverviewActionTile(tile: DismissibleOverviewActionTileId) {
    return executeServerAction(
        { tile }, kDismissOverviewActionTileData, async (data, props) =>
    {
        await requireVolunteerAuthentication(props.authenticationContext);
        await writeUserSetting(
            props.user.id, kOverviewActionTileSettings[data.tile], /* hidden= */ true);

        return { success: true };
    });
}
