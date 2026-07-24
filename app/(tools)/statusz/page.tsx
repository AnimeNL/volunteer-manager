// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { LocalDateTime } from '@app/admin/components/LocalDateTime';

/**
 * Displays high-level component information including version details, start time and uptime. This
 * is supposed to be a structured data endpoint (e.g. JSON), but it'd be a faff with layout.tsx to
 * make that happen so we just roll with this.
 */
export default function StatuszPage() {
    const instant = Temporal.Instant.from(process.env.NEXT_PUBLIC_PROJECT_BUILD_DATE!);
    const zonedDateTime = instant.toZonedDateTimeISO('UTC');

    // React serialisation ocassionally adds empty comment nodes between text nodes, avoid that by
    // having the `versionString` as a single value in the JSX so that the healthcheck can match it.
    const versionString = ` [${process.env.NEXT_PUBLIC_PROJECT_BUILD_HASH}]`;

    return (
        <Stack direction="column" spacing={1} sx={{ p: 2 }}>
            <Typography variant="h5">
                Version { process.env.NEXT_PUBLIC_PROJECT_VERSION }
            </Typography>
            <Typography variant="body2">
                Built on{' '}
                <LocalDateTime dateTime={zonedDateTime.toString()} format="dddd, MMMM D, YYYY" />
                {versionString}
            </Typography>
            <Typography>
                <strong>Next.js version</strong>: { process.env.NEXT_PUBLIC_VERSION_NEXTJS }
            </Typography>
            <Typography>
                <strong>Node.js version</strong>: { process.env.NEXT_PUBLIC_VERSION_NODEJS }
            </Typography>
            <Typography>
                <strong>React version</strong>: { process.env.NEXT_PUBLIC_VERSION_REACT }
            </Typography>
        </Stack>
    );
}
