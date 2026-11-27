// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useState } from 'react';

import type { SvgIconComponent } from '@mui/icons-material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import Grid from '@mui/material/Grid';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';

import type { TileAccentKey } from './OverviewTile';
import { OverviewActionTile, OverviewHeroTile } from './OverviewTile';
import { getSchedulePath } from '../lib/navigationTypes';

import { type DismissibleOverviewActionTileId,
    dismissOverviewActionTile } from './OverviewActions';

/**
 * Identifier of an actionable tile on the schedule overview page.
 */
export type OverviewTileId = DismissibleOverviewActionTileId | 'scanner' | 'schedule';

/**
 * Static metadata describing each actionable overview tile.
 */
interface OverviewTileMetadata {
    accent?: TileAccentKey;
    icon: SvgIconComponent;
    label: string;
    prefetch?: boolean;
    segment: string;
    subtitle?: string;
}

/**
 * Returns whether the given `tileId` can be dismissed by the volunteer.
 */
function isDismissibleTile(tileId: OverviewTileId): tileId is DismissibleOverviewActionTileId {
    return tileId === 'feedback' || tileId === 'hotel' || tileId === 'ticket';
}

/**
 * Registry of overview tile definitions indexed by tile ID. Each tile keeps a stable colour
 * identity (`accent` omitted for primary, or an analogous tone) regardless of layout slot.
 */
const kOverviewTiles: Record<OverviewTileId, OverviewTileMetadata> = {
    feedback: {
        accent: 'tileAccentC',
        icon: FeedbackOutlinedIcon,
        label: 'Feedback',
        segment: '/feedback',
    },
    hotel: {
        accent: 'tileAccentA',
        icon: HotelOutlinedIcon,
        label: 'Hotel',
        prefetch: true,
        segment: '/hotel',
    },
    scanner: {
        accent: 'tileAccentD',
        icon: QrCodeScannerIcon,
        label: 'Scanner',
        segment: '/scanner',
    },
    schedule: {
        accent: 'tileAccentB',
        icon: AccessTimeIcon,
        label: 'Schedule',
        segment: '/schedule',
    },
    ticket: {
        icon: ConfirmationNumberOutlinedIcon,
        label: 'Your ticket',
        prefetch: true,
        segment: '/ticket',
        subtitle: 'Welcoming you to the festival',
    },
};

/**
 * Props accepted by the `<OverviewTiles>` component.
 */
interface OverviewTilesProps {
    /**
     * Slug of the active event used to build schedule destination URLs.
     */
    eventSlug: string;

    /**
     * Ordered list of eligible, non-dismissed action tile IDs to display.
     */
    tiles: OverviewTileId[];
}

/**
 * Renders the Bento grid of CTA tiles on the schedule overview page. When visible, the `ticket`
 * tile occupies the horizontal hero slot while all other tiles render in the supporting grid.
 */
export function OverviewTiles(props: OverviewTilesProps) {
    const { eventSlug } = props;
    const [ dismissed, setDismissed ] = useState<ReadonlySet<OverviewTileId>>(() => new Set());

    async function handleDismiss(tileId: DismissibleOverviewActionTileId) {
        setDismissed(current => new Set([ ...current, tileId ]));

        const response = await dismissOverviewActionTile(tileId);
        if (!response.success) {
            setDismissed(current => {
                const next = new Set(current);
                next.delete(tileId);
                return next;
            });
        }
    }

    const visibleIds = props.tiles.filter(id => !dismissed.has(id));
    if (!visibleIds.length)
        return null;

    const showTicket = visibleIds.includes('ticket');
    const supportingIds = visibleIds.filter(id => id !== 'ticket');
    const supportingGridSize = supportingIds.length > 3 ? { xs: 6, sm: 'grow' as const } : 'grow';

    function getTileProps(tileId: OverviewTileId) {
        const tile = kOverviewTiles[tileId];
        return {
            accent: tile.accent,
            href: getSchedulePath(eventSlug, tile.segment),
            icon: tile.icon,
            label: tile.label,
            onDismiss: isDismissibleTile(tileId) ? () => handleDismiss(tileId) : undefined,
            prefetch: tile.prefetch,
        };
    }

    return (
        <Grid container spacing={1.25}>
            { showTicket &&
                <Grid size={{ xs: 12, md: supportingIds.length > 0 ? 5 : 12 }}>
                    <OverviewHeroTile
                        {...getTileProps('ticket')}
                        subtitle={kOverviewTiles.ticket.subtitle} />
                </Grid> }

            { supportingIds.length > 0 &&
                <Grid container spacing={1.25} size={showTicket ? { xs: 12, md: 7 } : 12}>
                    { supportingIds.map(tileId => (
                        <Grid key={tileId} size={supportingGridSize}>
                            <OverviewActionTile {...getTileProps(tileId)} />
                        </Grid>
                    )) }
                </Grid> }
        </Grid>
    );
}
