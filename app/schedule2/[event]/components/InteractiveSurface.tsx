// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useEffect, useState } from 'react';

import type { ButtonBaseTypeMap, ExtendButtonBase } from '@mui/material/ButtonBase';
import type { SxProps, Theme } from '@mui/material/styles';
import ButtonBase from '@mui/material/ButtonBase';
import { styled } from '@mui/material/styles';

/**
 * Returns a key that increments when a route is hidden via Next.js `<Activity mode="hidden">`,
 * remounting MUI `<TouchRipple>` surfaces so in-flight ripples are not stranded and replayed on
 * back navigation.
 */
export function useActivityRippleKey(): number {
    const [ rippleKey, setRippleKey ] = useState<number>(0);
    useEffect(() => () => setRippleKey(key => key + 1), []);
    return rippleKey;
}

/**
 * Props accepted by the `<InteractiveSurface>` component.
 */
interface InteractiveSurfaceProps {
    /**
     * Destination URL navigated to when the surface is activated.
     */
    href: string;

    /**
     * Surface presentation: `'transparent'` (default) for rows inside cards, or `'card'` for
     * standalone rounded paper cards with tonal hover tinting.
     */
    surface?: 'card' | 'transparent';

    /**
     * Optional MUI `sx` overrides forwarded to the underlying `<ButtonBase>`.
     */
    sx?: SxProps<Theme>;
}

/**
 * Reusable interactive client link surface wrapping MUI `<ButtonBase component={Link}>` with
 * `<Activity>`-safe ripple remounting.
 */
export function InteractiveSurface(props: React.PropsWithChildren<InteractiveSurfaceProps>) {
    const { children, href, surface = 'transparent', sx } = props;
    const rippleKey = useActivityRippleKey();

    return (
        <SurfaceButton key={rippleKey} component={Link} href={href} surface={surface} sx={sx}>
            {children}
        </SurfaceButton>
    );
}

/**
 * Styled `<ButtonBase>` link primitive supporting both transparent row surfaces and paper cards.
 */
const SurfaceButton = styled(ButtonBase, {
    shouldForwardProp: prop => prop !== 'surface',
})<{ surface: 'card' | 'transparent' }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        display: 'flex',
        textAlign: 'left',
        textDecoration: 'none',
        transition: theme.transitions.create('background-color', {
            duration: theme.transitions.duration.shorter,
        }),
        width: '100%',

        '&:hover': {
            backgroundColor: palette.action.hover,
        },

        variants: [
            {
                props: { surface: 'card' },
                style: {
                    backgroundColor: palette.background.paper,
                    borderRadius: theme.shape.borderRadius,
                    color: palette.text.primary,
                    overflow: 'hidden',

                    '&:hover': {
                        backgroundColor:
                            `color-mix(in srgb, ${palette.background.paper} 94%, ` +
                            `${palette.text.primary})`,
                    },
                },
            },
        ],
    };
}) as ExtendButtonBase<ButtonBaseTypeMap<{ surface: 'card' | 'transparent' }>>;
