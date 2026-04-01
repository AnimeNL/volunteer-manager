// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useEffect } from 'react';

import { setTitle } from '../ScheduleTitle';

/**
 * Props accepted by the <SetTitle> component.
 */
interface SetTitleProps {
    /**
     * The title the schedule app should be updated to.
     */
    title: string;
}

/**
 * The <SetTitle> component updates the current page's title. While client-side components are able
 * to call `setTitle()` directly, server side components do not have that ability.
 */
export function SetTitle(props: SetTitleProps) {
    useEffect(() => {
        setTitle(props.title);
    }, [ props.title ]);

    return undefined;
}
