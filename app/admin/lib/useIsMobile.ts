// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext } from 'react';

import { AdminClientContext } from '@app/admin/AdminClientContext';

/**
 * Hook representing whether the used display is presumed to be a mobile device.
 */
export function useIsMobile() {
    const { isMobile } = useContext(AdminClientContext);
    return isMobile;
}
