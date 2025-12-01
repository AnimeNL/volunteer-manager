// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useEffect, useState } from 'react';

declare namespace globalThis {
    let animeConTitleListeners: Set<(title: string) => void>;
    let animeConTitle: string;
}

/**
 * Initialise the global title configuration, and listener set.
 */
globalThis.animeConTitleListeners = new Set;
globalThis.animeConTitle = 'AnimeCon';

/**
 * Updates the page title to `title`. May cause re-renderings elsewhere in the app.
 */
export function setTitle(title?: string) {
    if (!title || title === globalThis.animeConTitle)
        return;  // this allows the call to live before any conditionals

    globalThis.animeConTitle = title;
    for (const listener of globalThis.animeConTitleListeners)
        listener(title);
}

/**
 * Creates React state that observes the title, and returns the current title.
 */
export function useTitle() {
    const [ title, setTitle ] = useState<string>(globalThis.animeConTitle);
    useEffect(() => {
        const updateTitle = (title: string) => setTitle(title);

        globalThis.animeConTitleListeners.add(updateTitle);
        return () => { globalThis.animeConTitleListeners.delete(updateTitle); };

    }, [ /* no dependencies */ ]);

    return title;
}
