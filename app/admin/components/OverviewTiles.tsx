// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import type SvgIcon from '@mui/material/SvgIcon';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';

/**
 * Props accepted by the <OverviewTiles> component.
 */
interface OverviewTilesProps {
    /**
     * Tiles that should be displayed on the page.
     */
    tiles: OverviewTileProps[];
}

/**
 * Tiles to display on an overview page. These are pseudo-accessible pages that link through to the
 * individual pages part of the area.
 */
export function OverviewTiles(props: OverviewTilesProps) {
    return (
        <Grid container spacing={2}>
            { props.tiles.map(tile => <OverviewTile key={tile.label} {...tile} />) }
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
    Icon: typeof SvgIcon;

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
                        startIcon={ <props.Icon /> } color="inherit">
                    {props.label}
                </Button>
            </Paper>
        </Grid>
    );
}
