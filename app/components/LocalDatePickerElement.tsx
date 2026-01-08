// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { DatePickerElement, type DatePickerElementProps } from 'react-hook-form-mui/date-pickers';

import { dayjs } from '@lib/DateTime';

/**
 * Variant of the <DatePickerElement> that ensures that both input and output values are represented
 * as plain dates (YYYY-MM-DD) as opposed to timezoned variants. The server does not have the
 * necessary information available in order to interpret those correctly, particularly the client's
 * local timezone, which could lead to incorrect dates being stored.
 */
export function LocalDatePickerElement(props: Omit<DatePickerElementProps, 'transform'>) {
    return <DatePickerElement {...props} transform={{
        output: value => {
            if (dayjs.isDayjs(value))
                return value.format('YYYY-MM-DD');

            return value;
        },
    }} />;
}
