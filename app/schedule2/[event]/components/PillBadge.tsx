// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Tooltip from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';

import { mixColor } from '../lib/scheduleStyles';

import { kPillBorderRadius } from '../Constants';

/**
 * Supported colour treatments for `<PillBadge>`.
 */
type PillBadgeTone = 'secondary' | 'warning';

/**
 * Props accepted by the `<PillBadge>` component.
 */
interface PillBadgeProps {
    icon?: React.ReactNode;
    label: React.ReactNode;
    mx?: number;
    title: string;
    tone?: PillBadgeTone;
}

/**
 * Rounded tonal pill wrapped in a MUI `<Tooltip>` for status labels and inline counters.
 */
export function PillBadge(props: PillBadgeProps) {
    const { icon, label, mx, title, tone = 'secondary' } = props;

    return (
        <Tooltip title={title}>
            <PillRoot aria-label={title} mx={mx} tone={tone}>
                {icon}
                {label}
            </PillRoot>
        </Tooltip>
    );
}

const PillRoot = styled('span', {
    shouldForwardProp: prop => prop !== 'mx' && prop !== 'tone',
})<{ mx?: number; tone: PillBadgeTone }>(({ mx, theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        alignItems: 'center',
        borderRadius: kPillBorderRadius,
        display: 'inline-flex',
        flexShrink: 0,
        fontSize: theme.typography.caption.fontSize,
        gap: theme.spacing(0.5),
        lineHeight: theme.typography.caption.lineHeight,
        marginLeft: mx !== undefined ? theme.spacing(mx) : undefined,
        marginRight: mx !== undefined ? theme.spacing(mx) : undefined,

        variants: [
            {
                props: { tone: 'secondary' },
                style: {
                    backgroundColor: palette.secondary.main,
                    color: palette.secondary.contrastText,
                    fontWeight: 600,
                    height: 22,
                    justifyContent: 'center',
                    minWidth: 22,
                    paddingLeft: theme.spacing(0.75),
                    paddingRight: theme.spacing(0.75),
                },
            },
            {
                props: { tone: 'warning' },
                style: {
                    backgroundColor: mixColor(palette.warning.main, 13),
                    color: palette.warning.main,
                    paddingBottom: theme.spacing(0.25),
                    paddingLeft: theme.spacing(1),
                    paddingRight: theme.spacing(1),
                    paddingTop: theme.spacing(0.25),
                },
            },
        ],
    };
});
