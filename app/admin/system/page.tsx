// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import Link from '@app/LinkProxy';

import type SvgIcon from '@mui/material/SvgIcon';
import ApiIcon from '@mui/icons-material/Api';
import AppsIcon from '@mui/icons-material/Apps';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import LoopIcon from '@mui/icons-material/Loop';
import Paper from '@mui/material/Paper';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';

/**
 * Overview page for the System pages. Displays a set of tiles that link through to the individual
 * sections. Made available to enable linkability in breadcrumbs.
 */
export default async function SystemPage() {
    return (
        <>
            <Section icon={ <AppsIcon color="primary" /> } title="System"
                     breadcrumbs={[ { label: 'System' }]}>
                <SectionIntroduction>
                    Collection of pages that either control or provide insight into the behaviour of
                    the Volunteer Manager.
                </SectionIntroduction>
            </Section>
            <Grid container spacing={2}>
                <OverviewPageTile Icon={AutoAwesomeIcon} href="/admin/system/ai/communication"
                                  label="AI" />
                <OverviewPageTile Icon={QueryStatsIcon} href="/admin/system/diagnostics/logs"
                                  label="Diagnostics" />
                <OverviewPageTile Icon={ApiIcon} href="/admin/system/integrations"
                                  label="Integrations" />
                <OverviewPageTile Icon={LoopIcon} href="/admin/system/scheduler"
                                  label="Scheduler" />
                <OverviewPageTile Icon={SettingsOutlinedIcon} href="/admin/system/settings"
                                  label="Settings" />
            </Grid>
        </>
    );
}

/**
 * Props accepted by the <OverviewPageTile> component.
 */
interface OverviewPageTileProps {
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
export function OverviewPageTile(props: OverviewPageTileProps) {
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

export const metadata: Metadata = {
    title: 'System | AnimeCon Volunteer Manager',
};
