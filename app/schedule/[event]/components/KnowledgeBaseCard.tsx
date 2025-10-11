// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import ReadMoreIcon from '@mui/icons-material/ReadMore';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { kThemeImageVersion } from '@app/config';

/**
 * Props accepted by the <KnowledgeBaseCard> component.
 */
interface KnowledgeBaseCardProps {
    /**
     * Slug of the event for which the card is being shown.
     */
    slug: string;
}

/**
 * The <KnowledgeBaseCard> displays a card allowing volunteers on mobile devices to enter the
 * Knowledge Base. A card is used as there is no space for a menu option.
 */
export function KnowledgeBaseCard(props: KnowledgeBaseCardProps) {
    return (
        <Card>
            <CardActionArea LinkComponent={Link} href={`/schedule/${props.slug}/knowledge`}>
                <Box sx={{
                    backgroundImage:
                        `url(/images/theme/knowledge-base-category.jpg?${kThemeImageVersion})`,
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    width: '100%',
                    aspectRatio: 4 }} />
                <CardContent>
                    <Stack direction="row" alignItems="center">
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Check out the <strong>Knowledge Base</strong>, where you can find
                            answers to the most frequently asked questions by visitors!
                        </Typography>
                        <ReadMoreIcon color="disabled" sx={{ ml: 2 }} />
                    </Stack>
                </CardContent>
            </CardActionArea>
        </Card>
    );
}
