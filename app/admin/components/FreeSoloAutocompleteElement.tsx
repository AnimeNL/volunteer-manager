// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Controller } from '@proxy/react-hook-form-mui';

import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';

/**
 * Props accepted by the <FreeSoloAutocompleteElement> component.
 */
export interface FreeSoloAutocompleteElementProps {
    /**
     * Label to display for the input field.
     */
    label: string;

    /**
     * Name of the field within the enclosing react-hook-form context.
     */
    name: string;

    /**
     * Suggested options presented in the autocomplete dropdown.
     */
    options: string[];

    /**
     * Whether a non-empty value is required to submit the form.
     */
    required?: boolean;
}

/**
 * Form-integrated free-solo <Autocomplete> field that suggests known options while also allowing
 * arbitrary freeform text input, keeping react-hook-form state in sync on every edit.
 */
export function FreeSoloAutocompleteElement(props: FreeSoloAutocompleteElementProps) {
    const { label, name, options, required } = props;

    return (
        <Controller
            name={name}
            rules={required ? { required: 'This field is required' } : undefined}
            render={ ({ field, fieldState }) => (
                <Autocomplete
                    forcePopupIcon
                    freeSolo
                    fullWidth
                    size="small"
                    options={options}
                    value={field.value || null}
                    inputValue={field.value ?? ''}
                    onChange={ (_event, newValue) => field.onChange(newValue ?? '') }
                    onInputChange={ (_event, newInputValue, reason) => {
                        if (reason === 'input' || reason === 'clear')
                            field.onChange(newInputValue);
                    } }
                    onBlur={field.onBlur}
                    renderInput={ params => (
                        <TextField
                            {...params}
                            inputRef={field.ref}
                            name={field.name}
                            label={label}
                            required={required}
                            error={!!fieldState.error}
                            helperText={fieldState.error?.message} />
                    ) } />
            ) } />
    );
}
