// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { Cache } from '@lib/cache';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEvent } from '../requireAuthenticationWithEvent';

/**
 * Data that needs to be available to update the ticket settings.
 */
const kTicketSettingsData = z.object({
    
});

/**
 * Server Action through which settings for an event's ticket management can be updated.
 */
export async function updateTicketSettings(eventSlug: string, formData: unknown) {
    return executeServerAction(formData, kTicketSettingsData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            eventSlug, props.authenticationContext, 'event.tickets');

        // TODO: Not yet implemented

        return { success: true };
    });
}

/**
 * Server Action through which the event ticket types cache can be cleared.
 */
export async function clearEventTicketTypesCache(eventSlug: string) {
    return executeServerAction(new FormData(), z.object({}), async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            eventSlug, props.authenticationContext, 'event.tickets');

        const cache = Cache.getInstance('EventTicketTypes');
        cache.delete(event.slug);

        return { success: true };
    });
}
