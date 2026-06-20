// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback } from 'react';

import { AutocompleteElement, type AutocompleteElementProps }
    from '@components/proxy/react-hook-form-mui';

/**
 * Type of option that can be provided to our internal <AutocompleteElement> variant.
 */
export type AutocompleteOption = {
    /**
     * Unique ID that refers to the value that can be selected.
     */
    id: number | string;

    /**
     * Label that should be assigned to the autocomplete element.
     */
    label: string;

    /**
     * Whether the option should be disabled.
     */
    disabled?: boolean;
};

/**
 * Props accepted by the <AutocompleteElementWithDisabledOptions> component.
 */
export type AutocompleteElementWithDisabledOptionsProps<TValue, Multiple extends boolean> =
    AutocompleteElementProps<TValue,
                             /* Multiple= */ Multiple,
                             /* DisableClearable= */ false,
                             /* FreeSolo= */ false>;

/**
 * The <SelectElementWithDisabledOptions> component is a regular RHF MUI <SelectElement>, but with
 * a client-side listener that respects the "disabled" property in options.
 */
export function AutocompleteElementWithDisabledOptions<TValue extends AutocompleteOption,
                                                       Multiple extends boolean = false>(
    props: AutocompleteElementWithDisabledOptionsProps<TValue, Multiple>)
{
    const { autocompleteProps, ...restProps } = props;

    const handleOptionDisabled = useCallback((option: any) => {
        return !!option.disabled;
    }, [ /* no dependencies */ ]);

    // `AutocompleteElementProps` from react-hook-form-mui wraps MUI's `AutocompleteProps`, which
    // takes five generic arguments. Spreading props and inferring types across this hierarchy is
    // extremely complex and slow. This cast saves ~3 seconds in compilation time.
    const AutocompleteElementCast = AutocompleteElement as any;

    return (
        <AutocompleteElementCast {...restProps}
                                 autocompleteProps={{
                                     ...autocompleteProps,
                                     getOptionDisabled: handleOptionDisabled,
                                 }} />
    );
}
