// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext } from 'react';

import Paper, { type PaperProps } from '@mui/material/Paper';

import { AdminClientContext } from '../AdminClientContext';

/**
 * Props accepted by the <ResponsivePaper> component.
 */
interface ResponsivePaperProps extends PaperProps {
    /**
     * Whether this section should be highlighted with a slightly different background color.
     */
    highlight?: boolean;
}

/**
 * Variant of the MUI <Paper> component that becomes square and margin-less when displayed on a
 * mobile device, to ensure proper utilisation of the already restricted screen estate.
 */
export function ResponsivePaper(props: ResponsivePaperProps) {
    const { children, highlight, sx, ...otherProps } = props;

    const { isMobile } = useContext(AdminClientContext);
    return (
        <Paper square={isMobile} {...otherProps} sx={{
            backgroundColor: highlight ? 'var(--mui-palette-backgroundHighlight)' : undefined,
            marginLeft: isMobile ? '-8px !important' : undefined,
            marginRight: isMobile ? '-8px !important' : undefined,
            ...sx,
        }}>
            {children}
        </Paper>
    );
}
