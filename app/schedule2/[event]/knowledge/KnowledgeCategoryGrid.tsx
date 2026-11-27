// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Box from '@mui/material/Box';
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
                <Grid key={category.id} size={{ xs: 12, sm: 6 }}>
                    <CategoryTile
                        href={getSchedulePath(eventSlug, `/knowledge/${category.id}`)}
                        surface="card">
                        <Box aria-hidden data-watermark="">
                            <KnowledgeBaseIcon
                                sx={{ fontSize: 'inherit' }}
                                variant={category.icon} />
                        </Box>
                        <Stack spacing={1.25} sx={{
                            height: '100%',
                            justifyContent: 'space-between',
                            minWidth: 0,
                            position: 'relative',
                            width: '100%',
                            zIndex: 1,
                        }}>
                            <Stack direction="row" spacing={1} sx={{
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}>
                                <IconBadge size="sm">
                                    <KnowledgeBaseIcon fontSize="small" variant={category.icon} />
                                </IconBadge>
                                <Stack direction="row" spacing={0.75} sx={{
                                    alignItems: 'center',
                                    flexShrink: 0,
                                }}>
                                    { category.limited &&
                                        <RestrictedBadge
                                            icon={ <LockOutlinedIcon fontSize="inherit" /> }
                                            title="Access is limited" /> }
                                    <Typography variant="caption" color="textSecondary" sx={{
                                        fontVariantNumeric: 'tabular-nums',
                                    }}>
                                        {pluralize(category.questionCount, 'question')}
                                    </Typography>
                                </Stack>
                            </Stack>

                            <Box sx={{ minWidth: 0 }}>
                                <Stack direction="row" spacing={0.5} sx={{
                                    alignItems: 'center',
                                    minWidth: 0,
                                }}>
                                    <Typography
                                        noWrap
                                        sx={{ lineHeight: 1.25 }}
                                        variant="subtitle2">
                                        {category.title}
                                    </Typography>
                                    <ArrowForwardIcon data-arrow="" fontSize="inherit" />
                                </Stack>
                                { !!category.description &&
                                    <Typography variant="body2" color="textSecondary" sx={{
                                        WebkitBoxOrient: 'vertical',
                                        WebkitLineClamp: 2,
                                        display: '-webkit-box',
                                        lineHeight: 1.35,
                                        mt: 0.25,
                                        overflow: 'hidden',
                                    }}>
                                        {category.description}
                                    </Typography> }
                            </Box>
                        </Stack>
                    </CategoryTile>
                </Grid> ) }
        </Grid>
    );
}

/**
 * Interactive category tile surface owning hover transitions for its corner watermark and arrow.
 */
const CategoryTile = styled(InteractiveSurface)(({ theme }) => {
    const palette = (theme.vars || theme).palette;
    const easing = theme.transitions.easing.easeOut;

    return {
        alignItems: 'stretch',
        height: '100%',
        padding: theme.spacing(1.5),
        position: 'relative',

        '& [data-watermark]': {
            bottom: -12,
            color: palette.secondary.contrastText,
            display: 'flex',
            fontSize: '4rem',
            opacity: 0.055,
            pointerEvents: 'none',
            position: 'absolute',
            right: -8,
            transform: 'rotate(-10deg)',
            transition: theme.transitions.create([ 'opacity', 'transform' ], {
                duration: theme.transitions.duration.standard,
                easing,
            }),
        },
        '& [data-arrow]': {
            color: palette.primary.main,
            flexShrink: 0,
            opacity: 0.55,
            transition: theme.transitions.create([ 'opacity', 'transform' ], {
                duration: theme.transitions.duration.shorter,
                easing,
            }),
        },
        '&:hover [data-watermark]': { opacity: 0.11, transform: 'rotate(-3deg) scale(1.08)' },
        '&:hover [data-arrow]': { opacity: 1, transform: 'translateX(3px)' },
        '@media (prefers-reduced-motion: reduce)': {
            '&:hover [data-watermark]': { transform: 'rotate(-10deg)' },
            '&:hover [data-arrow]': { transform: 'none' },
        },
    };
});
