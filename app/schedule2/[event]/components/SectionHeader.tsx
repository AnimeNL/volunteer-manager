// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MuiLink from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Props accepted by the <SectionHeader> component.
 */
interface SectionHeaderProps {
    /**
     * Optional right-aligned label displayed beside the chevron when `href` is set (e.g.
     * "Full schedule").
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
     * Primary section heading text, rendered with MUI's uppercase `overline` typography.
     */
    title: React.ReactNode;
}

/**
 * Frameless section header rendered directly on the content sheet above a `<ScheduleList>`. Can
 * optionally link through to a detail page with a right-aligned action label and chevron.
 */
export function SectionHeader(props: SectionHeaderProps) {
    const { actionLabel, href, muted = false, title } = props;

    const content = (
        <Stack direction="row" spacing={1} sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: '1.25rem',
            minWidth: 0,
            px: 0.5,
        }}>
            <Typography
                component="h2"
                variant="overline"
                color={muted ? 'textDisabled' : 'textSecondary'}
                noWrap>
                {title}
            </Typography>
            { !!href &&
                <Stack direction="row" sx={{
                    alignItems: 'center',
                    color: 'text.secondary',
                    flexShrink: 0,
                }}>
                    { !!actionLabel &&
                        <Typography variant="caption" color="inherit" sx={{ lineHeight: 1.5 }}>
                            {actionLabel}
                        </Typography> }
                    <ChevronRightIcon fontSize="small" sx={{ ml: -0.5, mr: -0.75 }} />
                </Stack> }
        </Stack>
    );

    if (!href)
        return content;

    return (
        <MuiLink component={Link} href={href} color="inherit" underline="none"
                 sx={{ WebkitTapHighlightColor: 'transparent', display: 'block' }}>
            {content}
        </MuiLink>
    );
}
