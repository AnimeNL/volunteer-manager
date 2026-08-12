// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Collapse from '@mui/material/Collapse';
import Grid, { type GridProps } from '@mui/material/Grid';

/**
 * Props accepted by the <GridCollapse> component.
 */
interface GridCollapseProps extends GridProps {
    /**
     * Whether the collapsed contents are visible.
     */
    in: boolean;
}

/**
 * The <GridCollapse> component is a regular Grid item that can be collapsed, at which point it will
 * take zero space, similar to MUI's <Collapse> component.
 */
export function GridCollapse(props: GridCollapseProps) {
    const { children, in: expanded, ...gridProps } = props;

    if (!expanded)
        return null;

    return (
        <Grid {...gridProps}>
            <Collapse in={expanded} timeout="auto" mountOnEnter unmountOnExit>
                {children}
            </Collapse>
        </Grid>
    );
}
