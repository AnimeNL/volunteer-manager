// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Alert from '@mui/material/Alert';
import FolderCopyOutlinedIcon from '@mui/icons-material/FolderCopyOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';

/**
 * Overview page for the Diagnostics, providing links to each section contained therein.
 */
export default async function DiagnosticsPage() {
    return (
        <>
            <Section icon={ <FolderCopyOutlinedIcon color="primary" /> } title="Cache Management"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Cache Management' },
                     ]}>
                <SectionIntroduction>
                    Insight and control over the Volunteer Manager's data internal caches.
                </SectionIntroduction>
            </Section>
            <Alert severity="warning" variant="outlined">
                This page has not been implemented yet.
            </Alert>
        </>
    );
}
