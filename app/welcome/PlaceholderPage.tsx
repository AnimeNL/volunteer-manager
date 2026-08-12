// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { ExportLayout } from '@app/(tools)/exports/[slug]/ExportLayout';

/**
 * The <PlaceholderPage> component is a full-page cover that shows that no behaviour is presently
 * configured at the current environment.
 */
export function PlaceholderPage() {
    return (
        <ExportLayout eventName="AnimeCon Volunteering Teams">
            <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h5" sx={{ pb: 2 }}>
                    Great Things Ahead!
                </Typography>
                <Typography variant="body1">
                    Please note that this page is not yet complete. We are in the process of
                    preparing content and will make it available as soon as possible.
                </Typography>
            </Paper>
        </ExportLayout>
    );
}
