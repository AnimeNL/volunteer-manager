// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext } from 'react';

import Stack from '@mui/material/Stack';

import { AdminClientContext } from '@app/admin/AdminClientContext';

/**
 * Containing component for content in the administration area. Arranges the children so that they
 * stack horizontally.
 */
export function AdminContent(props: React.PropsWithChildren) {
    const { isLayoutV2, isMobile } = useContext(AdminClientContext);
    return (
        <Stack direction={ isMobile ? 'column' : 'row' }
               spacing={2} sx={{
                   flexGrow: isLayoutV2 ? 1 : undefined,
                   pt: isLayoutV2 ? 0 : 2,
                   pb: isLayoutV2 ? 0 : 1
               }}>
            {props.children}
        </Stack>
    );
}
