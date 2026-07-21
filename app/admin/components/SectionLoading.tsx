// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

/**
 * Placeholder component to show while an asynchronous operation is completing in a section.
 */
export function SectionLoading(props: { disablePadding?: boolean }) {
    return (
        <Stack direction="column" spacing={0.25} sx={{
            marginTop: props.disablePadding ? '0px !important' : undefined
        }}>
            <Skeleton animation="wave" height={8} width="90%" />
            <Skeleton animation="wave" height={8} width="85%" />
            <Skeleton animation="wave" height={8} width="88%" />
            <Skeleton animation="wave" height={8} width="92%" />
            <Skeleton animation="wave" height={8} width="98%" />
        </Stack>
    );
}
