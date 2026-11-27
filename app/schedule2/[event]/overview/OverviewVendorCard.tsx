// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Fragment } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Divider from '@mui/material/Divider';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { VendorTeam } from '@lib/database/Types';
import { IconBadge } from '../components/IconBadge';
import { InteractiveSurface } from '../components/InteractiveSurface';
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
                        <IconBadge
                            size="sm"
                            tone={isEmpty
                                ? 'muted'
                                : (entry.team === kVendorTeam.FirstAid ? 'error' : 'info')}>
                            {icon}
                        </IconBadge>
                        <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                            <Typography variant="subtitle2" color="textPrimary"
                                        sx={{ lineHeight: 1.25 }}>
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
                            <InteractiveSurface
                                href={getSchedulePath(eventSlug, `/vendors/${entry.team}`)}
                                sx={{ px: 2, py: 1.25 }}>
                                {content}
                            </InteractiveSurface>
                        ) : (
                            <Box sx={{ display: 'flex', px: 2, py: 1.25, width: '100%' }}>
                                {content}
                            </Box>
                        ) }
                    </Fragment>
                );
            }) }
        </Card>
    );
}
