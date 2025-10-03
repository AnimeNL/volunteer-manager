// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Stack from '@mui/material/Stack';
import useMediaQuery from '@mui/material/useMediaQuery';

/**
 * Props accepted by the <AdminContent> component.
 */
interface AdminContentProps {
    /**
     * Whether the component should support responsive content.
     */
    responsive?: boolean;
}

/**
 * Containing component for content in the administration area. Arranges the children so that they
 * stack horizontally.
 */
export function AdminContent(props: React.PropsWithChildren<AdminContentProps>) {
    const isSmallScreenDevice =
        !!props.responsive &&
        // Intentional rule violation because this is a static, transitionary feature:
        // biome-ignore lint/correctness/useHookAtTopLevel: intentional behaviour
        useMediaQuery(theme => theme.breakpoints.down('md'));

    return (
        <Stack direction={ isSmallScreenDevice ? 'column' : 'row' }
               spacing={2} sx={{ pt: 2, pb: 1 }}>
            {props.children}
        </Stack>
    );
}
