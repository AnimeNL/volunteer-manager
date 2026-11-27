// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Box from '@mui/material/Box';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Grid from '@mui/material/Grid';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import type { KnowledgeBaseCategorySummary } from '../lib/data/knowledgeData';
import { IconBadge } from '../components/IconBadge';
import { InteractiveSurface } from '../components/InteractiveSurface';
import { KnowledgeBaseIcon } from '@components/KnowledgeBaseIcon';
import { RestrictedBadge } from '../components/RestrictedBadge';
import { getSchedulePath } from '../lib/navigationTypes';
import { pluralize } from '../lib/format';
import { subtleDividerBorder } from '../ScheduleTheme';

/**
 * Props accepted by the <KnowledgeCategoryGrid> component.
 */
interface KnowledgeCategoryGridProps {
    /**
     * Ordered list of visible Knowledge Base categories to display.
     */
    categories: KnowledgeBaseCategorySummary[];

    /**
     * Slug of the active event used to build category destination URLs.
     */
    eventSlug: string;
}

/**
 * Renders the Knowledge Base categories in a responsive Material Design 3 Bento Grid (2 columns on
 * desktop/tablet, 1 column on mobile) using MUI's `<Grid>`.
 */
export function KnowledgeCategoryGrid(props: KnowledgeCategoryGridProps) {
    const { categories, eventSlug } = props;

    return (
        <Grid container spacing={1.25}>
            { categories.map(category =>
                <KnowledgeCategoryCard
                    key={category.id}
                    category={category}
                    eventSlug={eventSlug} /> ) }
        </Grid>
    );
}

/**
 * Props accepted by the <KnowledgeCategoryCard> component.
 */
interface KnowledgeCategoryCardProps {
    /**
     * Knowledge Base category summary to display.
     */
    category: KnowledgeBaseCategorySummary;

    /**
     * Slug of the active event used to build the category destination URL.
     */
    eventSlug: string;
}

/**
 * Renders a single Knowledge Base category card inside the responsive Bento grid.
 */
function KnowledgeCategoryCard(props: KnowledgeCategoryCardProps) {
    const { category, eventSlug } = props;
    const countLabel = pluralize(category.questionCount, 'question');

    return (
        <Grid size={{ xs: 12, sm: 6 }}>
            <InteractiveSurface
                href={getSchedulePath(eventSlug, `/knowledge/${category.id}`)}
                surface="card"
                sx={{ alignItems: 'stretch', height: '100%', p: 1.75 }}>
                <Stack spacing={1.5} sx={{
                    height: '100%',
                    justifyContent: 'space-between',
                    width: '100%',
                }}>
                    <Stack spacing={1.25} sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={1} sx={{
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                        }}>
                            <IconBadge size="md">
                                <KnowledgeBaseIcon fontSize="small" variant={category.icon} />
                            </IconBadge>
                            { category.limited &&
                                <RestrictedBadge
                                    icon={ <LockOutlinedIcon fontSize="inherit" /> }
                                    pillLabel="Limited"
                                    title="Access is limited" /> }
                        </Stack>

                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2">
                                {category.title}
                            </Typography>
                            { !!category.description &&
                                <Typography variant="body2" color="textSecondary" sx={{
                                    WebkitBoxOrient: 'vertical',
                                    WebkitLineClamp: 2,
                                    display: '-webkit-box',
                                    mt: 0.5,
                                    overflow: 'hidden',
                                }}>
                                    {category.description}
                                </Typography> }
                        </Box>
                    </Stack>

                    <CategoryFooter direction="row">
                        <Typography variant="caption" color="textSecondary" sx={{
                            fontVariantNumeric: 'tabular-nums',
                        }}>
                            {countLabel}
                        </Typography>
                        <Stack direction="row" spacing={0.25} sx={{
                            alignItems: 'center',
                            color: 'primary.main',
                        }}>
                            <Typography variant="caption" color="inherit" sx={{ fontWeight: 600 }}>
                                Browse
                            </Typography>
                            <ChevronRightIcon fontSize="small" sx={{ mr: -0.5 }} />
                        </Stack>
                    </CategoryFooter>
                </Stack>
            </InteractiveSurface>
        </Grid>
    );
}

/**
 * Footer row displaying question count and browse cue separated by a subtle hairline divider.
 */
const CategoryFooter = styled(Stack)(({ theme }) => ({
    alignItems: 'center',
    borderTop: subtleDividerBorder(theme),
    justifyContent: 'space-between',
    paddingTop: theme.spacing(1),
}));
