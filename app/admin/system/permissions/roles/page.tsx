// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * The roles page displays an overview of all roles in the system and their assigned permissions.
 */
export default async function RolesPage() {
    await requireAuthentication('system.permissions');

    return (
        <>
            <Section icon={ <WorkOutlineOutlinedIcon color="primary" /> } title="Roles"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Permissions', href: '/admin/system/permissions' },
                         { label: 'Roles' },
                     ]}>
                <SectionIntroduction>
                    Roles group permissions together and can be assigned to principals.
                </SectionIntroduction>
            </Section>
            <Section tabs noHeader>
                TODO
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Roles', 'Permissions', 'System');
