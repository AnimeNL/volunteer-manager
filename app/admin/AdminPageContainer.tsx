// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext } from 'react';

import Stack from '@mui/material/Stack';

import { AdminClientContext } from './AdminClientContext';

/**
 * Container for actual content in the administrative area. Stretches itself out.
 */
export function AdminPageContainer(props: React.PropsWithChildren) {
    const { isLayoutV2 } = useContext(AdminClientContext);
    if (isLayoutV2)
        return props.children;

    return (
        <Stack direction="column" spacing={2} sx={{ flexGrow: 1, minWidth: 0 }}>
            {props.children}
        </Stack>
    );
}
