// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import type SvgIcon from '@mui/material/SvgIcon';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';

import { useSectionTabContext } from './SectionTabContextClient';

/**
 * Props accepted by the <OverviewTiles> component.
 */
type OverviewTilesProps = {
    /**
     * Tiles that should be displayed on the page.
     */
    tiles: OverviewTileProps[];
} | {
    /**
     * Tiles that should be displayed on the page should be derived from the layout.
     */
    layout: true;

    /**
     * Additional tiles that should be displayed on the page.
     */
    tiles?: OverviewTileProps[];
};

/**
 * Tiles to display on an overview page. These are pseudo-accessible pages that link through to the
 * individual pages part of the area.
 */
export function OverviewTiles(props: OverviewTilesProps) {
    if (!('layout' in props)) {
        return (
            <Grid container spacing={2}>
                { props.tiles.map(tile => <OverviewTile key={tile.label} {...tile} />) }
            </Grid>
        );
    }

    return <OverviewTilesFromLayout tiles={props.tiles} />;
}

/**
 * Displays tiles derived from the layout context that must exist in the page hierarchy.
 */
function OverviewTilesFromLayout(props: { tiles?: OverviewTileProps[] }) {
    const context = useSectionTabContext();
    if (!context) {
        return (
            <Alert severity="error" variant="outlined">
                No section tab context is available in the page hierarchy.
            </Alert>
        );
    }

    const tiles: OverviewTileProps[] = [
        ...props.tiles ?? [],
        ...context.tabs.map(tab => ({
            Icon: tab.Icon,
            href: tab.url,
            label: tab.label,
        })),
    ];

    tiles.sort((lhs, rhs) => lhs.label.localeCompare(rhs.label));

    return (
        <Grid container spacing={2}>
            { tiles.map(tile => <OverviewTile key={tile.label} {...tile} />) }
        </Grid>
    );
}

/**
 * Props accepted by the <OverviewTile> component.
 */
interface OverviewTileProps {
    /**
     * Icon to display on the tile.
     */
    Icon?: typeof SvgIcon;

    /**
     * URL that the tile should link to.
     */
    href: string;

    /**
     * Label to display next to the icon.
     */
    label: string;
}

/**
 * Tile to display on the overview page. Will link through to the actual page with an icon and a
 * descriptive text. Designed to be responsive.
 */
export function OverviewTile(props: OverviewTileProps) {
    return (
        <Grid size={{ xs: 6, md: 4, lg: 3 }}>
            <Paper sx={{ p: 1 }}>
                <Button LinkComponent={Link} href={props.href} fullWidth
                        startIcon={ props.Icon ? <props.Icon /> : undefined } color="inherit">
                    {props.label}
                </Button>
            </Paper>
        </Grid>
    );
}
