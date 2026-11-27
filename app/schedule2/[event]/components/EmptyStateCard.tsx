// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';

/**
 * Props accepted by the `<EmptyStateCard>` component.
 */
interface EmptyStateCardProps {
    description: React.ReactNode;

    /**
     * When `true`, renders only `<CardContent>` for use inside a static outer `<Card>`.
     */
    noCard?: boolean;

    title?: React.ReactNode;
}

/**
 * Shared empty-state surface card displaying a secondary message and optional heading.
 */
export function EmptyStateCard(props: EmptyStateCardProps) {
    const content = (
        <CardContent>
            { !!props.title &&
                <Typography variant="h6" gutterBottom>
                    {props.title}
                </Typography> }
            <Typography variant="body2" color="textSecondary">
                {props.description}
            </Typography>
        </CardContent>
    );

    return props.noCard ? content : <Card>{content}</Card>;
}
