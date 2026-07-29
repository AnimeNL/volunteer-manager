// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { SettingsHeader } from './SettingsHeader';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';

/**
 * The <EventSettingsPage> page allows event administrators to make changes to an event, such as its
 * name, slug, target team sizes and so on. These have an effect on the entire Volunteer Manager.
 */
export default async function EventSettingsPage(
    props: PageProps<'/admin/events/[event]/settings'>)
{
    const params = await props.params;

    const { event } = await verifyAccessAndFetchPageInfo(props.params, {
        permission: 'event.settings',
        scope: {
            event: params.event,
        },
    });

    return (
        <SettingsHeader event={event} />
    );
}

export const generateMetadata = createGenerateMetadataFn('Settings', { event: 'event' });
