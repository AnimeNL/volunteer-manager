// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { RolesDataTable } from './RolesDataTable';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@app/admin/lib/requireAuthentication';

/**
 * The <RolesPage> component enables the volunteer to adjust the roles that are available on the
 * Volunteer Manager. Roles define what function people exercise within our organisation.
 */
export default async function RolesPage() {
    const { access } = await requireAuthentication('organisation.roles');

    // Note that only root can create new roles:
    return <RolesDataTable enableCreate={ access.can('root') } />;
}

export const generateMetadata = createGenerateMetadataFn('Roles', 'Organisation');
