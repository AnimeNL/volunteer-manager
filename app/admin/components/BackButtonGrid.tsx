// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';

/**
 * Props accepted by the <BackButtonGrid> component.
 */
interface BackButtonGridProps {
    /**
     * URL that the user should navigate to when activating this entity.
     */
    href: string;

    /**
     * Size of the grid. Defaults to full width, i.e. 12.
     */
    size?: number;
}

/**
 * The <BackButtonGrid> component displays a back button to a given url in a <Grid> section. This
 * is particularly useful for tabbed interfaces in which there may not be another obvious manner of
 * navigation back to the previous page.
 */
export function BackButtonGrid(props: React.PropsWithChildren<BackButtonGridProps>) {
    return (
        <Grid size={{ xs: props.size ?? 12 }}>
            <Button size="small" variant="text" LinkComponent={Link} href={props.href}
                    startIcon={ <ArrowBackIcon /> } sx={{ ml: -0.5, mb: 0.75 }}>
                { props.children || 'Back' }
            </Button>
        </Grid>
    );
}
