// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from 'next/link';

import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Props accepted by the <SectionHeader> component.
 */
interface SectionHeaderProps {
    /**
     * Optional right-aligned label displayed beside the chevron when `href` is set (e.g. "Schedule").
     */
    actionLabel?: string;

    /**
     * Optional destination URL making the section header interactive.
     */
    href?: string;

    /**
     * Whether to dim the heading text, typically used for past or finished sections.
     */
    muted?: boolean;

    /**
     * Primary section heading text.
     */
    title: React.ReactNode;

    /**
     * Optional React View Transition types applied when navigating via `href`.
     */
    transitionTypes?: string[];

    /**
     * Visual hierarchy variant: sentence-case `'title'` for rooms/entities (default), or uppercase
     * `'overline'` for day or status groupings.
     */
    variant?: 'overline' | 'title';
}

/**
 * Frameless section header rendered directly on the content sheet above a `<ScheduleList>`. Can
 * optionally link through to a detail page with a right-aligned action label and chevron.
 */
export function SectionHeader(props: SectionHeaderProps) {
    const { actionLabel, href, muted = false, title, transitionTypes, variant = 'title' } = props;

    const isOverline = variant === 'overline';
    const titleColor = muted
        ? 'textDisabled'
        : isOverline
            ? 'textSecondary'
            : 'textPrimary';

    const content = (
        <Stack direction="row" spacing={1} sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            minWidth: 0,
            px: 0.5,
        }}>
            <Typography
                component="h2"
                variant={isOverline ? 'caption' : 'subtitle2'}
                color={titleColor}
                noWrap
                sx={isOverline ? {
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                } : {
                    fontWeight: 600,
                }}>
                {title}
            </Typography>
            { !!href &&
                <Stack direction="row" spacing={0.25} sx={{
                    alignItems: 'center',
                    color: 'text.secondary',
                    flexShrink: 0,
                }}>
                    { !!actionLabel &&
                        <Typography variant="caption" color="inherit" sx={{ fontWeight: 500 }}>
                            {actionLabel}
                        </Typography> }
                    <ChevronRightIcon fontSize="small" />
                </Stack> }
        </Stack>
    );

    if (!href)
        return content;

    return (
        <Link href={href} transitionTypes={transitionTypes} style={{
            color: 'inherit',
            display: 'block',
            textDecoration: 'none',
        }}>
            {content}
        </Link>
    );
}
