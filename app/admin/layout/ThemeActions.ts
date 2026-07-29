// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { executeServerAction } from '@lib/serverAction';
import { writeUserSetting } from '@lib/UserSettings';

/**
 * Data model for the `updateUserColour` Server Action.
 */
const kUpdateUserColourData = z.object({
    colour: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

/**
 * Server Action through which the colour chosen by the signed in user can be updated to `colour`.
 */
export async function updateUserColour(colour?: string) {
    'use server';
    return executeServerAction({ colour }, kUpdateUserColourData, async (data, props) => {
        await writeUserSetting(props.user.id, 'admin-theme-color', data.colour);
    });
}
