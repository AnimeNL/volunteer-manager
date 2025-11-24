// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useFormContext } from 'react-hook-form-mui';

/**
 * Props accepted by the <HiddenInput> component.
 */
interface HiddenInputProps {
    /**
     * Name of the form field.
     */
    name: string;
}

/**
 * The <HiddenInput> component is a regular <input type=hidden>, but one that registers with RHF and
 * thus participates in form submission.
 */
export function HiddenInput(props: HiddenInputProps) {
    const { register } = useFormContext();
    return <input type="hidden" {...register(props.name)} />;
}
