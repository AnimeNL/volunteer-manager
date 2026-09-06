// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import KeyIcon from '@mui/icons-material/Key';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * The permissions page displays an overview of all permissions known to the Volunteer Manager,
 * with descriptions and details about who has access to them.
 */
export default async function PermissionsPage() {
    await requireAuthentication('system.permissions');

    return (
        <>
            <Section icon={ <KeyIcon color="primary" /> } title="Permissions"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Permissions', href: '/admin/system/permissions' },
                         { label: 'Permissions' },
                     ]}>
                <SectionIntroduction>
                    Individual permissions that control access to capabilities within the Volunteer
                    Manager.
                </SectionIntroduction>
            </Section>
            <Section tabs noHeader>
                TODO
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Permissions', 'System');
