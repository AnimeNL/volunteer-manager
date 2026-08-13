// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useMemo } from 'react';

import { Controller, useFormContext } from 'react-hook-form-mui';
import { MuiColorInput, matchIsValidColor, type MuiColorInputProps, type MuiColorInputValue }
    from 'mui-color-input';

/**
 * Colour validator that works with fields that are not required, which the mui-color-input library
 * doesn't deal well with when used in conjunction with RHF.
 */
function optionalColourValidator(required: boolean, color: MuiColorInputValue): boolean {
    if (!required && !color)
        return true;

    return matchIsValidColor(color);
}

/**
 * Props accepted by the <ColorInput> component.
 */
interface ColorInputProps extends Omit<MuiColorInputProps, 'format' | 'name' | 'value'> {
    /**
     * Name of the input field is required, to integrate with React Hook Form.
     */
    name: string;
};

/**
 * The <ColorInput> component wraps the `mui-color-input` library in a client component with the
 * right configuration for use in the Volunteer Manager, i.e. color display format and integration
 * with react-hook-form.
 */
export function ColorInput(props: ColorInputProps) {
    const { control } = useFormContext();
    const { name, ...inputProps } = props;

    const validate = useMemo(() => optionalColourValidator.bind(null, !!props.required), [ props.required ]);

    return (
        <Controller name={name} control={control}
                    rules={{
                        required: props.required,
                        validate: validate,
                    }}
                    render={ ({ field, fieldState }) =>
                        <MuiColorInput
                            {...inputProps} {...field}
                            fallbackValue="#ffffff"
                            format="hex"
                            isAlphaHidden />
                    } />
    );
}
