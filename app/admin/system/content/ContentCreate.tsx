// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { type FieldValues, type FieldValue, TextFieldElement }
    from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';

import type { ServerAction } from '@lib/serverAction';
import { FormGrid } from '../../components/FormGrid';

/**
 * Validates the path for content that should be added to the scope. We only validate syntax here,
 * not whether the content already exists or other restrictions may be in place.
 */
export function validateContentPath(value: FieldValue<FieldValues>): true | string {
    if (!/^[/.a-zA-Z0-9-]+$/.test(value))
        return 'This must be a valid URL path';

    return true;
}

/**
 * Props accepted by the <ContentCreate> component.
 */
interface ContentCreateProps {
    /**
     * Server Action through which creation of a new content page can be submitted.
     */
    createFn: ServerAction;

    /**
     * Prefix to display at the beginning of the content's path.
     */
    pathPrefix?: string;
}

/**
 * The <ContentCreate> component displays a form through which new content can be created. It
 * handles prefixes, URL validation, and forwards the user to the modify page once done.
 */
export function ContentCreate(props: ContentCreateProps) {
    return (
        <FormGrid action={props.createFn} callToAction="Create page">
            <Grid size={{ xs: 12 }}>
                <TextFieldElement name="title" label="Content title" fullWidth size="small"
                                  required />
            </Grid>
            <Grid size={{ xs: 12 }}>
                <TextFieldElement name="path" label="Content path" fullWidth size="small"
                                  required rules={{ validate: validateContentPath }}
                                  slotProps= {{
                                      input: {
                                          startAdornment:
                                              props.pathPrefix
                                                  ? <InputAdornment position="start">
                                                        {props.pathPrefix}
                                                    </InputAdornment>
                                                  : undefined,
                                      }
                                  }} />
            </Grid>
        </FormGrid>
    );
}
