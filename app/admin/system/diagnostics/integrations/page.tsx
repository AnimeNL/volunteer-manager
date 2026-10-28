// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import ApiIcon from '@mui/icons-material/Api';
import Typography from '@mui/material/Typography';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * The integration logs page displays an overview of the API calls made by the Volunteer Manager,
 * including their input, output and response times.
 */
export default async function IntegrationLogsPage() {
    await requireAuthentication({
        permission: 'system.logs',
        operation: 'read',
    });

    return (
        <>
            <Section icon={ <ApiIcon color="primary" /> } title="Integration logs"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Diagnostics', href: '/admin/system/diagnostics' },
                         { label: 'Integration logs' },
                     ]}>
                <SectionIntroduction>
                    Overview of the external API calls made by the Volunteer Manager, including
                    their input, output and response times.
                </SectionIntroduction>
            </Section>
            <Section tabs noHeader>
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    Integration call logs will be displayed here.
                </Typography>
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Integration logs', 'Diagnostics', 'System');
