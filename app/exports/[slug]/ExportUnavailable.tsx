// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy'

import { default as MuiLink } from '@mui/material/Link';
import Paper from '@mui/material/Paper';

import type { ExportMetadata } from './ExportMetadata';

/**
 * Determines the reason that the export described by the `metadata` no longer can be accessed in a
 * human readable manner.
 */
function determineReason(metadata: ExportMetadata): string {
    if (!metadata.enabled)
        return ' because access was rescinded by one of our leads';
    if (!metadata.accessDateValid)
        return ' because access is time bound, which has now expired';
    if (!metadata.accessViewsValid)
        return ' because we limit how often it can be accessed, which has been exceeded';

    return /* unknown reason= */ '';
}

/**
 * Props accepted by the <ExportUnavailable> component.
 */
interface ExportUnavailableProps {
    /**
     * Metadata about the export that's being presented on this page.
     */
    metadata: ExportMetadata;
}

/**
 * The <ExportUnavailable> component displays an error page when an export exists but no longer is
 * available. It explains that the requester will have to request a new link from their source.
 */
export function ExportUnavailable(props: ExportUnavailableProps) {
    return (
        <Paper sx={{ p: 2, textAlign: 'center' }}>
            Unfortunately the data you have requested no longer is available
            {determineReason(props.metadata)}. Please contact the person who shared it with you
            in case you still need access, or{' '}
            <MuiLink component={Link} href="mailto:crew@animecon.nl">
                {props.metadata.userName}
            </MuiLink> who provisioned the data on behalf of our organisation.
        </Paper>
    );
}
