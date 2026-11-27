// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Avatar from '@mui/material/Avatar';
import { styled } from '@mui/material/styles';

/**
 * Supported dimensions and corner treatments for `<IconBadge>`.
 */
type IconBadgeSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Supported colour treatments for `<IconBadge>`.
 */
export type IconBadgeTone = 'error' | 'info' | 'muted' | 'secondary';

/**
 * Props accepted by the `<IconBadge>` component.
 */
interface IconBadgeProps {
    /**
     * Size preset controlling dimensions and border radius. Defaults to `'md'`.
     */
    size?: IconBadgeSize;

    /**
     * Tonal surface and icon colour preset. Defaults to `'secondary'`.
     */
    tone?: IconBadgeTone;
}

/**
 * Shared tonal icon badge built on MUI `<Avatar>` for headers, category tiles, vendor rows, and
 * empty/blocked states.
 */
export function IconBadge(props: React.PropsWithChildren<IconBadgeProps>) {
    const { children, size = 'md', tone = 'secondary' } = props;

    return (
        <StyledIconBadge
            aria-hidden="true"
            badgeSize={size}
            tone={tone}
            variant={size === 'xl' ? 'circular' : 'rounded'}>
            {children}
        </StyledIconBadge>
    );
}

const StyledIconBadge = styled(Avatar, {
    shouldForwardProp: prop => prop !== 'badgeSize' && prop !== 'tone',
})<{ badgeSize: IconBadgeSize; tone: IconBadgeTone }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        flexShrink: 0,
        variants: [
            {
                props: { badgeSize: 'sm' },
                style: { borderRadius: 10, height: 32, width: 32 },
            },
            {
                props: { badgeSize: 'md' },
                style: { borderRadius: 10, height: 40, width: 40 },
            },
            {
                props: { badgeSize: 'lg' },
                style: {
                    borderRadius: theme.shape.borderRadius,
                    height: 46,
                    width: 46,
                    [theme.breakpoints.up('md')]: {
                        borderRadius: Number(theme.shape.borderRadius) / 2,
                    },
                },
            },
            {
                props: { badgeSize: 'xl' },
                style: { height: 64, width: 64 },
            },
            {
                props: { tone: 'secondary' },
                style: {
                    backgroundColor: palette.secondary.main,
                    color: palette.secondary.contrastText,
                },
            },
            {
                props: { tone: 'error' },
                style: {
                    backgroundColor: `color-mix(in srgb, ${palette.error.main} 14%, transparent)`,
                    color: palette.error.main,
                },
            },
            {
                props: { tone: 'info' },
                style: {
                    backgroundColor: `color-mix(in srgb, ${palette.info.main} 14%, transparent)`,
                    color: palette.info.main,
                },
            },
            {
                props: { tone: 'muted' },
                style: {
                    backgroundColor: palette.action.hover,
                    color: palette.text.disabled,
                },
            },
        ],
    };
});
