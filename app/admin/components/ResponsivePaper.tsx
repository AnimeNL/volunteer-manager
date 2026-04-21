// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Paper, { type PaperProps } from '@mui/material/Paper';

import { useIsMobile } from '@app/admin/lib/useIsMobile';

/**
 * Variant of the MUI <Paper> component that becomes square and margin-less when displayed on a
 * mobile device, to ensure proper utilisation of the already restricted screen estate.
 */
export function ResponsivePaper(props: React.PropsWithChildren<PaperProps>) {
    const { children, sx, ...otherProps } = props;

    const isMobile = useIsMobile();

    return (
        <Paper square={isMobile} {...otherProps} sx={{
            marginLeft: isMobile ? '-16px !important' : undefined,
            marginRight: isMobile ? '-16px !important' : undefined,
            ...sx,
        }}>
            {children}
        </Paper>
    );
}
