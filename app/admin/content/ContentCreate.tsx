// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { type FieldValues, type FieldValue, FormContainer, TextFieldElement }
    from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ContentScope } from '@app/api/admin/content/[[...id]]/route';
import { SubmitCollapse } from '../components/SubmitCollapse';
import { callApi } from '@lib/callApi';

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
     * Prefix to apply to links to content management pages shown in the table.
     * @default "./content/"
     */
    linkPrefix?: string;

    /**
     * Prefix to display at the beginning of the content's path.
     */
    pathPrefix?: string;

    /**
     * Scope of the content that should be editable.
     */
    scope: ContentScope;
}

/**
 * The <ContentCreate> component displays a form through which new content can be created. It
 * handles prefixes, URL validation, and forwards the user to the modify page once done.
 */
export function ContentCreate(props: ContentCreateProps) {
    const [ error, setError ] = useState<string | undefined>();
    const [ invalidated, setInvalidated ] = useState<boolean>(false);
    const [ loading, setLoading ] = useState<boolean>(false);

    const router = useRouter();

    const handleChange = useCallback(() => setInvalidated(true), [ /* no deps */ ]);
    const handleSubmit = useCallback(async (data: FieldValues) => {
        setLoading(true);
        setError(undefined);
        try {
            const response = await callApi('post', '/api/admin/content', {
                context: props.scope,
                row: {
                    path: data.path,
                    title: data.title,
                },
            });

            if (response.success)
                router.push(`${props.linkPrefix ?? './content/'}${response.row.id}`);
            else
                setError(response.error ?? 'Unable to create the new content');
        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [ props.linkPrefix, props.scope, router ]);

    return (
        <FormContainer onSuccess={handleSubmit}>
            <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                    <TextFieldElement name="title" label="Content title" fullWidth size="small"
                                      onChange={handleChange} required />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <Stack direction="row" spacing={1}>
                        { props.pathPrefix &&
                            <Typography sx={{ pt: '9px' }}>
                                {props.pathPrefix}
                            </Typography> }
                        <TextFieldElement name="path" label="Content path" fullWidth size="small"
                                          required onChange={handleChange}
                                          rules={{ validate: validateContentPath }} />
                    </Stack>
                </Grid>
            </Grid>
            <SubmitCollapse error={error} loading={loading} open={invalidated} sx={{ mt: 2 }} />
        </FormContainer>
    );
}
