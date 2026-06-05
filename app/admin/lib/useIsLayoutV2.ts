// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext } from 'react';

import { AdminClientContext } from '@app/admin/AdminClientContext';

/**
 * Hook representing whether the new version of the layout is being used.
 */
export function useIsLayoutV2() {
    const { isLayoutV2 } = useContext(AdminClientContext);
    return isLayoutV2;
}
