// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { VendorPage } from '../VendorPage';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';

/**
 * The security team (normally supporting the Stewards) is responsible for the physical security of
 * our visitors and volunteers. They're a vendor team, and therefore not considered volunteers.
 */
export default async function EventTeamSecurityPage(
    props: PageProps<'/admin/events/[event]/[team]/security'>)
{
    return <VendorPage params={props.params} vendor="security" />;
}

export const generateMetadata = createGenerateMetadataFn(
    'Security', { team: 'team' }, { event: 'event' });
