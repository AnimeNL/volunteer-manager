// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext } from 'react';

import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';

import { AdminClientContext } from '@app/admin/AdminClientContext';

/**
 * Props accepted by the <SectionIntroduction> component.
 */
interface SectionIntroductionProps {
    /**
     * Whether the introduction is important and should receive additional emphasis.
     */
    important?: boolean;
}

/**
 * The <SectionIntroduction> component can be used to introduce the user to the purpose of a
 * particular section. The `important` prop can be used to give the explanation additional clarity.
 */
export function SectionIntroduction(props: React.PropsWithChildren<SectionIntroductionProps>) {
    const { isLayoutV2 } = useContext(AdminClientContext);
    if (!isLayoutV2) {
        return (
            <Alert severity={ !!props.important ? 'warning' : 'info' }>
                {props.children}
            </Alert>
        );
    } else {
        return (
            <Typography variant="body2">
                {props.children}
            </Typography>
        );
    }
}
