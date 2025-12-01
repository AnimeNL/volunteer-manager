// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { nanoid } from 'nanoid';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { type FieldValues, FormContainer, SelectElement, TextFieldElement }
    from '@proxy/react-hook-form-mui';

import type { ValueOptions } from '@mui/x-data-grid-pro';
import Grid from '@mui/material/Grid';

import type { ContentScope } from '@app/api/admin/content/[[...id]]/route';
import { SubmitCollapse } from '@app/admin/components/SubmitCollapse';
import { callApi } from '@lib/callApi';

/**
 * Props accepted by the <CreateQuestionForm> component.
 */
interface CreateQuestionFormProps {
    /**
     * Categories to which a question can be added.
     */
    categories: ValueOptions[];

    /**
     * Scope that should be used for sourcing the knowledge.
     */
    scope: ContentScope;
}

/**
 * The <CreateQuestionForm> component makes it possible to add new questions to the knowledge base.
 * Only the question is necessary—the answer can be filled in by to volunteer after the fact.
 */
export function CreateQuestionForm(props: CreateQuestionFormProps) {
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
                    path: nanoid(/* size= */ 8),
                    categoryId: data.category,
                    title: data.question,
                },
            });

            if (response.success)
                router.push(`./knowledge/${response.row.id}`);
            else
                setError(response.error ?? 'Unable to create the new question');
        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [ props.scope, router ]);

    return (
        <FormContainer onSuccess={handleSubmit}>
            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <SelectElement name="category" label="Category" fullWidth size="small"
                                   onChange={handleChange} options={props.categories} required />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <TextFieldElement name="question" label="Question…" fullWidth size="small"
                                      onChange={handleChange} required />
                </Grid>
            </Grid>


            <SubmitCollapse error={error} loading={loading} open={invalidated} sx={{ mt: 2 }} />
        </FormContainer>
    );
}
