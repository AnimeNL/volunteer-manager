// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from 'next/link';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Props accepted by the <ScheduleErrorCard> component.
 */
interface ScheduleErrorCardProps {
    /**
     * Concise explanation of why the page could not be displayed.
     */
    description: string;

    /**
     * HTTP status code label (e.g. `401`, `403`, `404`).
     */
    statusCode: 401 | 403 | 404;

    /**
     * Primary heading shown on the card.
     */
    title: string;
}

/**
 * Lightweight, `@lib/Environment`-free error card shared by the `unauthorized`, `forbidden`, and
 * `not-found` boundaries under `app/schedule2/[event]/`.
 */
export function ScheduleErrorCard(props: ScheduleErrorCardProps) {
    return (
        <Card>
            <CardContent>
                <Stack spacing={1}>
                    <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
                        Error {props.statusCode}
                    </Typography>
                    <Typography variant="h5">
                        {props.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {props.description}
                    </Typography>
                    <Typography variant="body2" sx={{ pt: 1 }}>
                        <Link href="/" style={{ color: 'inherit' }}>
                            Return to the Volunteer Portal
                        </Link>
                    </Typography>
                </Stack>
            </CardContent>
        </Card>
    );
}
