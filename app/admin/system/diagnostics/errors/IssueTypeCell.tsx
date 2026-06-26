// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Chip from '@mui/material/Chip';

import { kErrorSource, type ErrorSource } from '@lib/database/Types';

/**
 * Cell that renders the error source label in a colored chip.
 */
export function IssueTypeCell({ row }: { row: { source: ErrorSource } }) {
    switch (row.source) {
        case kErrorSource.Client:
            return <Chip color="primary" label="Client" size="small" />;
        case kErrorSource.Server:
            return <Chip color="info" label="Server" size="small" />;
    }
}

/**
 * Cell that renders a "dev" label chip if the error occurred on a local server.
 */
export function LocalBuildCell({ row }: { row: { isLocal?: boolean } }) {
    if (!row.isLocal)
        return null;

    return <Chip color="info" label="dev" size="small" />;
}
