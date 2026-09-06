// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * The principals page displays an overview of all principals (users and service accounts) that have
 * been granted permissions or roles within the Volunteer Manager.
 */
export default async function PrincipalsPage() {
    await requireAuthentication('system.permissions');

    return (
        <>
            <Section icon={ <PersonOutlinedIcon color="primary" /> } title="Principals"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Permissions', href: '/admin/system/permissions' },
                         { label: 'Principals' },
                     ]}>
                <SectionIntroduction>
                    Principals are users and service accounts that can be granted roles and
                    permissions.
                </SectionIntroduction>
            </Section>
            <Section tabs noHeader>
                TODO
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Principals', 'Permissions', 'System');
