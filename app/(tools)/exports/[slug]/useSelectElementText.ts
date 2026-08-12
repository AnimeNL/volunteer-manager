// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { type RefObject, useCallback, useRef } from 'react';

/**
 * Result returned by the `useSelectElementText` function.
 */
interface SelectElementResult<Type extends HTMLElement> {
    /**
     * The element reference indicating the element that should be selected.
     */
    elementRef: RefObject<Type | null>;

    /**
     * Callback that is to be invoked when the element's contents should be selected.
     */
    handleSelect: () => void;
}

/**
 * The `useSelectElementText()` method implements the ability to conveniently add a button that will
 * highlight and select all content of a particular HTML element.
 */
export function useSelectElementText<Type extends HTMLElement>(): SelectElementResult<Type> {
    const elementRef = useRef<Type>(null);
    const handleSelect = useCallback(() => {
        if (elementRef.current && !!document.createRange) {
            const range = document.createRange();
            const selection = document.getSelection();
            try {
                range.selectNodeContents(elementRef.current);
                selection?.removeAllRanges();
                selection?.addRange(range);
            } catch (error) {
                console.error('Unable to select all table content:', error);
            }
        }
    }, [ /* no deps */ ]);

    return { elementRef, handleSelect };
}
