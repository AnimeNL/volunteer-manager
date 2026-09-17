// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { or } from '@lib/auth/AuthenticationContext';

/**
 * These are the permissions that give access to the Organisation area, as well as its dashboard.
 * This check is shared and verified in at least three different places, hence factored out.
 */
export const kDashboardPermissions = or(
    {
        permission: 'organisation.accounts',
        operation: 'read',
    },
    'organisation.displays',
    {
        permission: 'organisation.environments',
        operation: 'read',
    },
    'organisation.exports',
    'organisation.feedback',
    'organisation.nardo',
    {
        permission: 'organisation.roles',
        operation: 'read',
    },
    {
        permission: 'organisation.teams',
        operation: 'read',
    },
);
