// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';

import type { ButtonBaseTypeMap, ExtendButtonBase } from '@mui/material/ButtonBase';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Card from '@mui/material/Card';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Divider from '@mui/material/Divider';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import type { VendorTeam } from '@lib/database/Types';
import { getSchedulePath } from '../lib/navigationTypes';

import { kVendorTeam } from '@lib/database/Types';

/**
 * Static display metadata for each vendor team shown on the overview card.
 */
const kVendorMetadata: Record<VendorTeam, { icon: React.ReactNode; title: string }> = {
    [kVendorTeam.FirstAid]: {
        icon: <LocalHospitalOutlinedIcon fontSize="small" />,
        title: 'First Aid',
    },
    [kVendorTeam.Security]: {
        icon: <ShieldOutlinedIcon fontSize="small" />,
        title: 'Security',
    },
};

/**
 * Entry describing a single on-site vendor team row in `<OverviewVendorCard>`.
 */
export interface OverviewVendorEntry {
    /**
     * Whether this row links through to the vendor team's full schedule.
     */
    clickable: boolean;

    /**
     * Alphabetically sorted first names of personnel currently on site (empty when nobody is).
     */
    names: string[];

    /**
     * Vendor team represented by this row.
     */
    team: VendorTeam;
}

/**
 * Props accepted by the <OverviewVendorCard> component.
 */
interface OverviewVendorCardProps {
    /**
     * Ordered list of vendor teams to display in the unified card.
     */
    entries: OverviewVendorEntry[];

    /**
     * Slug of the active event used to build destination URLs for clickable entries.
     */
    eventSlug: string;
}

/**
 * Displays a unified neutral card listing on-site First Aid and/or Security personnel. Rows are
 * plain text for most volunteers and become navigable links for volunteers with vendor-team access
 * when shifts are scheduled for that team.
 */
export function OverviewVendorCard(props: OverviewVendorCardProps) {
    const { entries, eventSlug } = props;

    // Remount <VendorRowButton> when Next.js hides this route via <Activity mode="hidden"> so
    // in-flight MUI <TouchRipple> elements are not stranded and replayed on back navigation.
    const [ rippleKey, setRippleKey ] = useState<number>(0);
    useEffect(() => () => setRippleKey(key => key + 1), []);

    if (!entries.length)
        return null;

    return (
        <Card>
            { entries.map((entry, index) => {
                const { icon, title } = kVendorMetadata[entry.team];
                const isEmpty = !entry.names.length;

                const content = (
                    <Stack direction="row" spacing={1.5}
                           sx={{ alignItems: 'center', minWidth: 0, width: '100%' }}>
                        <VendorIconBadge inactive={isEmpty} team={entry.team}>
                            {icon}
                        </VendorIconBadge>
                        <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                            <Typography variant="subtitle2" color="textPrimary"
                                        sx={{ fontWeight: 600, lineHeight: 1.25 }}>
                                {title}
                            </Typography>
                            <Typography variant="body2"
                                        color={isEmpty ? 'textDisabled' : 'textSecondary'}
                                        sx={{ lineHeight: 1.35 }}>
                                { isEmpty ? 'Nobody is currently on site' : entry.names.join(', ') }
                            </Typography>
                        </Box>
                        { entry.clickable &&
                            <ChevronRightIcon fontSize="small"
                                              sx={{ color: 'text.disabled', flexShrink: 0 }} /> }
                    </Stack>
                );

                return (
                    <Fragment key={entry.team}>
                        { index > 0 && <Divider /> }
                        { entry.clickable ? (
                            <VendorRowButton
                                key={rippleKey}
                                component={Link}
                                href={getSchedulePath(eventSlug, `/vendors/${entry.team}`)}>
                                {content}
                            </VendorRowButton>
                        ) : (
                            <VendorRowStatic>
                                {content}
                            </VendorRowStatic>
                        ) }
                    </Fragment>
                );
            }) }
        </Card>
    );
}

/**
 * Rounded tonal icon square matching the action tile badge geometry. Uses a subtle crimson or
 * blue tint when personnel are on site, and dims to a neutral surface in the zero state.
 */
const VendorIconBadge = styled(Box, {
    shouldForwardProp: prop => prop !== 'inactive' && prop !== 'team',
})<{ inactive: boolean; team: VendorTeam }>(({ theme }) => {
    const palette = (theme.vars || theme).palette;

    return {
        alignItems: 'center',
        borderRadius: 10,
        display: 'flex',
        flexShrink: 0,
        height: 32,
        justifyContent: 'center',
        width: 32,
        variants: [
            {
                props: { inactive: true },
                style: {
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    color: palette.text.disabled,
                    ...theme.applyStyles('dark', {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    }),
                },
            },
            {
                props: { inactive: false, team: kVendorTeam.FirstAid },
                style: {
                    backgroundColor: 'rgba(211, 47, 47, 0.12)',
                    color: '#c62828',
                    ...theme.applyStyles('dark', {
                        backgroundColor: 'rgba(239, 68, 68, 0.16)',
                        color: '#f09494',
                    }),
                },
            },
            {
                props: { inactive: false, team: kVendorTeam.Security },
                style: {
                    backgroundColor: 'rgba(25, 118, 210, 0.12)',
                    color: '#1565c0',
                    ...theme.applyStyles('dark', {
                        backgroundColor: 'rgba(96, 165, 250, 0.16)',
                        color: '#94c0f7',
                    }),
                },
            },
        ],
    };
});

/**
 * Interactive row surface for volunteers permitted to inspect the vendor team's full schedule.
 */
const VendorRowButton = styled(ButtonBase)(({ theme }) => ({
    display: 'flex',
    padding: theme.spacing(1.25, 2),
    textAlign: 'left',
    textDecoration: 'none',
    transition: theme.transitions.create('background-color', {
        duration: theme.transitions.duration.shorter,
    }),
    width: '100%',

    '&:hover': {
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        ...theme.applyStyles('dark', {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
        }),
    },
})) as ExtendButtonBase<ButtonBaseTypeMap>;

/**
 * Non-interactive row container sharing identical padding with `<VendorRowButton>`.
 */
const VendorRowStatic = styled(Box)(({ theme }) => ({
    display: 'flex',
    padding: theme.spacing(1.25, 2),
    width: '100%',
}));
