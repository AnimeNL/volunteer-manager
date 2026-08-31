// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { SelectElement, TextFieldElement } from '@proxy/react-hook-form-mui';

import type { ValueOptions } from '@mui/x-data-grid-premium';
import Grid from '@mui/material/Grid';

import type { ServerAction } from '@lib/serverAction';
import { FormGrid } from '@app/admin/components/FormGrid';

/**
 * Props accepted by the <CreateQuestionForm> component.
 */
interface CreateQuestionFormProps {
    /**
     * Categories to which a question can be added.
     */
    categories: ValueOptions[];

    /**
     * Server Action through which creation of a new content page can be submitted.
     */
    createFn: ServerAction;
}

/**
 * The <CreateQuestionForm> component makes it possible to add new questions to the knowledge base.
 * Only the question is necessary—the answer can be filled in by to volunteer after the fact.
 */
export function CreateQuestionForm(props: CreateQuestionFormProps) {
    return (
        <FormGrid action={props.createFn} callToAction="Create question">
            <Grid size={{ xs: 12, md: 4 }}>
                <SelectElement name="categoryId" label="Category" fullWidth size="small"
                               options={props.categories} required />
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
                <TextFieldElement name="title" label="Question…" fullWidth size="small" required />
            </Grid>
        </FormGrid>
    );
}
