// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { ButtonBaseTypeMap, ExtendButtonBase } from '@mui/material/ButtonBase';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Grid from '@mui/material/Grid';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import type { KnowledgeBaseCategorySummary } from '../lib/data/knowledgeData';
import { KnowledgeBaseIcon } from '@components/KnowledgeBaseIcon';
import { getSchedulePath } from '../lib/navigationTypes';

import { kCardBorderRadiusPx } from '../Constants';

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

    // Remount <CategoryCardButton> when Next.js hides this route via <Activity mode="hidden"> so
    // in-flight MUI <TouchRipple> elements are not stranded and replayed on back navigation.
    const [ rippleKey, setRippleKey ] = useState<number>(0);
    useEffect(() => () => setRippleKey(key => key + 1), []);

    return (
        <Grid container spacing={1.25}>
            { categories.map(category => {
                const countLabel = category.questionCount === 1
                    ? '1 question'
                    : `${category.questionCount} questions`;

                return (
                    <Grid key={category.id} size={{ xs: 12, sm: 6 }}>
                        <CategoryCardButton
                            key={rippleKey}
                            component={Link}
                            href={getSchedulePath(eventSlug, `/knowledge/${category.id}`)}>
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
                                        <CategoryIconBadge>
                                            <KnowledgeBaseIcon
                                                fontSize="small"
                                                variant={category.icon} />
                                        </CategoryIconBadge>
                                        { category.limited &&
                                            <Tooltip title="Access is limited">
                                                <LimitedBadge aria-label="Access is limited">
                                                    <LockOutlinedIcon fontSize="inherit" />
                                                    <span>Limited</span>
                                                </LimitedBadge>
                                            </Tooltip> }
                                    </Stack>

                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="subtitle2" sx={{
                                            fontWeight: 600,
                                            lineHeight: 1.35,
                                        }}>
                                            {category.title}
                                        </Typography>
                                        { !!category.description &&
                                            <CategoryDescription variant="body2">
                                                {category.description}
                                            </CategoryDescription> }
                                    </Box>
                                </Stack>

                                <CategoryFooter>
                                    <Typography variant="caption" color="textSecondary" sx={{
                                        fontVariantNumeric: 'tabular-nums',
                                    }}>
                                        {countLabel}
                                    </Typography>
                                    <Stack direction="row" spacing={0.25} sx={{
                                        alignItems: 'center',
                                        color: 'primary.main',
                                    }}>
                                        <Typography variant="caption" color="inherit" sx={{
                                            fontWeight: 600,
                                        }}>
                                            Browse
                                        </Typography>
                                        <ChevronRightIcon fontSize="small" sx={{ mr: -0.5 }} />
                                    </Stack>
                                </CategoryFooter>
                            </Stack>
                        </CategoryCardButton>
                    </Grid>
                );
            }) }
        </Grid>
    );
}

/**
 * Interactive M3 tonal Bento card button for a Knowledge Base category.
 */
const CategoryCardButton = styled(ButtonBase)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        alignItems: 'stretch',
        backgroundColor: palette.m3.card,
        borderRadius: kCardBorderRadiusPx,
        color: palette.text.primary,
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        padding: theme.spacing(1.75),
        textAlign: 'left',
        textDecoration: 'none',
        transition: theme.transitions.create('background-color', {
            duration: theme.transitions.duration.shorter,
        }),
        width: '100%',

        '&:hover': {
            backgroundColor: `color-mix(in srgb, ${palette.m3.card} 94%, ${palette.text.primary})`,
        },
    };
}) as ExtendButtonBase<ButtonBaseTypeMap>;

/**
 * Rounded 40px tonal squircle badge displaying the category's `<KnowledgeBaseIcon>`.
 */
const CategoryIconBadge = styled(Box)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        alignItems: 'center',
        backgroundColor: palette.m3.secondaryContainer,
        borderRadius: 10,
        color: palette.m3.onSecondaryContainer,
        display: 'flex',
        flexShrink: 0,
        height: 40,
        justifyContent: 'center',
        width: 40,
    };
});

/**
 * Warm-amber pill indicator denoting categories with restricted role or team visibility.
 */
const LimitedBadge = styled('span')(({ theme }) => ({
    alignItems: 'center',
    backgroundColor: 'rgba(140, 90, 18, 0.12)',
    borderRadius: 9999,
    color: '#8c5a12',
    display: 'inline-flex',
    flexShrink: 0,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: 500,
    gap: theme.spacing(0.5),
    lineHeight: 1.4,
    padding: theme.spacing(0.25, 1),
    ...theme.applyStyles('dark', {
        backgroundColor: 'rgba(217, 184, 124, 0.14)',
        color: '#d9b87c',
    }),
}));

/**
 * Muted category description clamped to two lines to keep Bento cards balanced in height.
 */
const CategoryDescription = styled(Typography)(({ theme }) => ({
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    color: (theme.vars || theme).palette.text.secondary,
    display: '-webkit-box',
    lineHeight: 1.45,
    marginTop: theme.spacing(0.5),
    overflow: 'hidden',
}));

/**
 * Subtle hairline-separated footer displaying the category's question count and browse affordance.
 */
const CategoryFooter = styled(Box)(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        alignItems: 'center',
        borderTop: `1px solid color-mix(in srgb, ${palette.divider} 65%, transparent)`,
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: theme.spacing(1),
    };
});
