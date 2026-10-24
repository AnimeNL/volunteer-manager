// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';

import { OverviewTiles } from '@app/admin/components/OverviewTiles';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * Overview page for Permissions, providing links to each section contained therein.
 */
export default async function PermissionsPage() {
    await requireAuthentication('system.permissions');

    return (
        <>
            <Section icon={ <AdminPanelSettingsOutlinedIcon color="primary" /> }
                     title="Permissions"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Permissions' },
                     ]}>
                <SectionIntroduction>
                    Insight and management of principals, permissions and roles within the
                    Volunteer Manager.
                </SectionIntroduction>
            </Section>
            <OverviewTiles layout />
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Permissions', 'System');
