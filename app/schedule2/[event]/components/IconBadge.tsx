// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Avatar from '@mui/material/Avatar';

/**
 * Supported dimensions and corner treatments for `<IconBadge>`.
 */
type IconBadgeSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Supported colour treatments for `<IconBadge>`.
 */
type IconBadgeTone = 'error' | 'info' | 'muted' | 'secondary';

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

const kSizeStyles = {
    sm: { borderRadius: '10px', height: 32, width: 32 },
    md: { borderRadius: '10px', height: 40, width: 40 },
    lg: { borderRadius: { xs: 1, md: 0.5 }, height: 46, width: 46 },
    xl: { height: 64, width: 64 },
};

const kToneStyles = {
    secondary: { bgcolor: 'secondary.main', color: 'secondary.contrastText' },
    error: {
        bgcolor: 'color-mix(in srgb, var(--mui-palette-error-main) 14%, transparent)',
        color: 'error.main',
    },
    info: {
        bgcolor: 'color-mix(in srgb, var(--mui-palette-info-main) 14%, transparent)',
        color: 'info.main',
    },
    muted: { bgcolor: 'action.hover', color: 'text.disabled' },
};

/**
 * Shared tonal icon badge built on MUI `<Avatar>` for headers, category tiles, vendor rows, and
 * empty/blocked states.
 */
export function IconBadge(props: React.PropsWithChildren<IconBadgeProps>) {
    const { children, size = 'md', tone = 'secondary' } = props;

    return (
        <Avatar
            aria-hidden="true"
            variant={size === 'xl' ? 'circular' : 'rounded'}
            sx={{ flexShrink: 0, ...kSizeStyles[size], ...kToneStyles[tone] }}>
            {children}
        </Avatar>
    );
}
