// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Context carrying the active AppBar title and setter for `app/schedule2/`.
 */
interface ScheduleTitleContextValue {
    title: string;
    setTitle: (title: string) => void;
}

const ScheduleTitleContext = createContext<ScheduleTitleContextValue>({
    title: 'AnimeCon',
    setTitle: () => {},
});

/**
 * Props accepted by the <ScheduleTitleProvider> component.
 */
interface ScheduleTitleProviderProps {
    /**
     * Initial static title rendered in the App Shell before a page overrides it.
     */
    defaultTitle: string;
}

/**
 * Provides mutable AppBar title state for the `app/schedule2/[slug]/` layout subtree.
 */
export function ScheduleTitleProvider(props: React.PropsWithChildren<ScheduleTitleProviderProps>) {
    const [ title, setTitle ] = useState<string>(props.defaultTitle);

    const value = useMemo(() => ({ title, setTitle }), [ title ]);

    return (
        <ScheduleTitleContext.Provider value={value}>
            {props.children}
        </ScheduleTitleContext.Provider>
    );
}

/**
 * Returns the active AppBar title from <ScheduleTitleProvider>.
 */
export function useScheduleTitle(): string {
    return useContext(ScheduleTitleContext).title;
}

/**
 * Props accepted by the <SetTitle> component.
 */
interface SetTitleProps {
    /**
     * Title to display in the AppBar while the owning page is active.
     */
    title: string;
}

/**
 * Updates the AppBar title when mounted or re-shown by React `<Activity>`. Renders nothing.
 */
export function SetTitle(props: SetTitleProps) {
    const { setTitle } = useContext(ScheduleTitleContext);

    useEffect(() => {
        setTitle(props.title);
    }, [ props.title, setTitle ]);

    return null;
}
