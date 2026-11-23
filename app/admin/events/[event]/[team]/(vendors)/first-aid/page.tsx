// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { VendorPage } from '../VendorPage';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';

/**
 * The first aid team (normally supporting the Stewards) is responsible for making sure that all our
 * visitors are safe, and any incidents are taken care of.
 */
export default async function EventTeamFirstAidPage(
    props: PageProps<'/admin/events/[event]/[team]/first-aid'>)
{
    return <VendorPage params={props.params} vendor="first-aid" />;
}

export const generateMetadata = createGenerateMetadataFn(
    'First aid', { team: 'team' }, { event: 'event' });
