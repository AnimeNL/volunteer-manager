// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext } from 'react';

import Paper, { type PaperProps } from '@mui/material/Paper';

import { AdminClientContext } from '../AdminClientContext';

/**
 * Variant of the MUI <Paper> component that becomes square and margin-less when displayed on a
 * mobile device, to ensure proper utilisation of the already restricted screen estate.
 */
export function ResponsivePaper(props: React.PropsWithChildren<PaperProps>) {
    const { children, sx, ...otherProps } = props;

    const { isMobile, isLayoutV2 } = useContext(AdminClientContext);

    const mobilePadding = isLayoutV2 ? '-8px !important' : '-16px !important';
    return (
        <Paper square={isMobile} {...otherProps} sx={{
            marginLeft: isMobile ? mobilePadding : undefined,
            marginRight: isMobile ? mobilePadding : undefined,
            ...sx,
        }}>
            {children}
        </Paper>
    );
}
