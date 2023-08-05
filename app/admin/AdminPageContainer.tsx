// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Stack from '@mui/material/Stack';

/**
 * Container for actual content in the administrative area. Stretches itself out.
 */
export function AdminPageContainer(props: React.PropsWithChildren) {
    return (
        <Stack direction="column" spacing={2} sx={{ flexGrow: 1 }}>
            {props.children}
        </Stack>
    );
}
