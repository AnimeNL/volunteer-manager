// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import AutoAwesomeMotionOutlinedIcon from '@mui/icons-material/AutoAwesomeMotionOutlined';

import { RolePermissionSelector } from '../../RolePermissionSelector';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tPermissionsRoles } from '@lib/database';

import { kRootRole } from '../../Root';

import { updateRolePermissions } from '../../PermissionActions';

/**
 * Page for managing an individual role.
 */
export default async function RoleDetailPage(
    props: PageProps<'/admin/system/permissions/roles/[id]'>)
{
    const { access } = await requireAuthentication('system.permissions');

    const { id } = await props.params;

    let role: {
        name: string;
        description: string;
        grants?: string;
        revokes?: string;
    } | null = null;

    if (id === 'root') {
        role = {
            ...kRootRole,
            grants: 'root',
        };
    } else {
        role = await db.selectFrom(tPermissionsRoles)
            .where(tPermissionsRoles.permissionRoleId.equals(id))
            .select({
                name: tPermissionsRoles.permissionRoleName,
                description: tPermissionsRoles.permissionRoleDescription,
                grants: tPermissionsRoles.permissionRoleGrants,
                revokes: tPermissionsRoles.permissionRoleRevokes,
            })
            .executeSelectNoneOrOne();
    }

    if (!role)
        notFound();

    const action = updateRolePermissions.bind(null, id);

    return (
        <>
            <Section icon={ <AutoAwesomeMotionOutlinedIcon color="primary" /> }
                     title={`Role: ${role.name}`}
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Permissions', href: '/admin/system/permissions' },
                         { label: 'Roles', href: '/admin/system/permissions/roles' },
                         { label: role.name },
                     ]}>
                <SectionIntroduction>
                    {role.description}
                </SectionIntroduction>
            </Section>
            <Section back="Back to roles" tabs noHeader>
                <RolePermissionSelector access={access} action={action} grants={role.grants}
                                        readOnly={ id === 'root' } revokes={role.revokes}
                                        roleId={id} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id' }, 'Roles', 'Permissions', 'System');
