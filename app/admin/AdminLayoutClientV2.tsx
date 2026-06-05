// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';

export const AdminMenu = styled('div')(({ theme }) => ({

}));

export const AdminPageWrapper = styled(Stack)(({ theme }) => ({
    backgroundColor: '#eff3f4',
    padding: theme.spacing(1),
}));

export const AdminSectionStack = styled(Stack)(({ theme }) => ({
    backgroundColor: '#0a0a0a',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1.5),
}));
