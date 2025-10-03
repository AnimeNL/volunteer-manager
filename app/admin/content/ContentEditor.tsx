// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';

import { type FieldValues, FormContainer, SelectElement, TextFieldElement }
    from '@proxy/react-hook-form-mui';

import type { ValueOptions } from '@mui/x-data-grid-pro';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MDXEditorMethods } from '@mdxeditor/editor';
import type { ContentRowModel, ContentScope } from '@app/api/admin/content/[[...id]]/route';
import type { SectionHeaderProps } from '../components/SectionHeader';
import { Section } from '../components/Section';
import { Temporal, formatDate } from '@lib/Temporal';
import { callApi } from '@lib/callApi';
import { validateContentPath } from './ContentCreate';

import '@mdxeditor/editor/style.css';

/**
 * Dynamically import the ContentEditorMdx component. Disable server-side rendering as that leads to
 * an hydration error in the NextJS app router.
 */
const ContentEditorMdx = dynamic(() => import('./ContentEditorMdx'), { ssr: false });

/**
 * Props accepted by the <ContentEditor> component.
 */
interface ContentEditorProps extends SectionHeaderProps {
    /**
     * Categories that can be assigned to the editor. Will be ignored when absent.
     */
    categories?: ValueOptions[];

    /**
     * Unique ID of the content that should be loaded. Will automatically be fetched from the API.
     */
    contentId: number;

    /**
     * Whether the path should be hidden in its entirety, in case it's not relevant for the type of
     * contant for which the editor is being presented.
     */
    pathHidden?: boolean;

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
 * The <ContentEditor> component is a fully functional content editor, built upon an MDX editor that
 * provides near-WYSIWYG editing capabilities. The editor will be lazily loaded to not contribute
 * to the bundle size, while still being available when it needs to be.
 */
export function ContentEditor(props: React.PropsWithChildren<ContentEditorProps>) {
    const { categories, children, contentId, pathHidden, pathPrefix, scope, ...sectionHeaderProps }
        = props;

    const ref = useRef<MDXEditorMethods>(null);

    const [ defaultValues, setDefaultValues ] = useState<ContentRowModel>();

    const [ error, setError ] = useState<string | undefined>();
    const [ loading, setLoading ] = useState<boolean>(false);
    const [ success, setSuccess ] = useState<string | undefined>();

    const handleSave = useCallback(async (data: FieldValues) => {
        setLoading(true);
        setError(undefined);
        setSuccess(undefined);
        try {
            if (!ref || !ref.current)
                throw new Error('Cannot locate the Markdown content on this page');

            const response = await callApi('put', '/api/admin/content/:id', {
                id: contentId,
                context: scope,
                row: {
                    id: contentId,
                    content: ref.current.getMarkdown(),
                    path: data.path ?? defaultValues?.path,
                    categoryId: data.categoryId ?? undefined,
                    title: data.title,
                    updatedOn: '',  // ignored
                    updatedBy: '',  // ignored
                    updatedByUserId: 0,  // ignored
                    protected: false,  // ignored
                },
            });

            if (response.success)
                setSuccess('The changes have been saved');
            else
                setError(response.error ?? 'The changes could not be saved');
        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [ defaultValues, contentId, scope ]);

    const [ contentProtected, setContentProtected ] = useState<boolean>(false);
    const [ markdown, setMarkdown ] = useState<string>();

    useEffect(() => {
        callApi('get', '/api/admin/content/:id', {
            id: contentId,
            context: scope
        }).then(response => {
            if (response.success) {
                setDefaultValues({
                    ...response.row,
                    updatedOn:
                        formatDate(
                            Temporal.ZonedDateTime.from(response.row.updatedOn),
                            'YYYY-MM-DD[T]HH:mm:ss[Z]'),
                });

                setContentProtected(!!response.row.protected);
                setMarkdown(response.row.content);
            } else {
                setError(response.error ?? 'Unable to load the content from the server');
            }
        });
    }, [ contentId, scope ]);

    if (!defaultValues) {
        return (
            <Section {...sectionHeaderProps}>
                {children}
                <Collapse in={!!error} unmountOnExit>
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                </Collapse>
                <Box>
                    <Skeleton variant="text" animation="wave" width="80%" height={16} />
                    <Skeleton variant="text" animation="wave" width="60%" height={16} />
                    <Skeleton variant="text" animation="wave" width="70%" height={16} />
                    <Skeleton variant="text" animation="wave" width="70%" height={16} />
                    <Skeleton variant="text" animation="wave" width="40%" height={16} />
                </Box>
            </Section>
        );
    }

    return (
        <FormContainer defaultValues={defaultValues} onSuccess={handleSave}>
            <Stack direction="column" spacing={2}>
                <Section {...sectionHeaderProps}>
                    {children}
                    <Grid container spacing={2} sx={{ margin: '8px -8px -8px -8px !important' }}>
                        { !!categories &&
                            <Grid size={{ xs: 12, md: 4 }}>
                                <SelectElement name="categoryId" label="Category" fullWidth
                                               size="small" options={categories} required />
                            </Grid> }
                        <Grid size={{ xs: 12, md: !!categories ? 8 : 12 }}>
                            <TextFieldElement name="title" label="Content title" fullWidth
                                              size="small" required />
                        </Grid>
                        { !pathHidden &&
                            <Grid size={{ xs: 12 }}>
                                <Stack direction="row" spacing={1}>
                                    { pathPrefix &&
                                        <Typography sx={{ pt: '9px' }}>
                                            {pathPrefix}
                                        </Typography> }
                                    <TextFieldElement name="path" label="Content path" fullWidth
                                                      size="small" required={!contentProtected}
                                                      rules={{
                                                          validate:
                                                              contentProtected ? undefined
                                                                              : validateContentPath
                                                      }}
                                                      slotProps={{
                                                          input: { readOnly: !!contentProtected }
                                                      }} />
                                </Stack>
                            </Grid> }
                    </Grid>
                </Section>
                <Section noHeader>
                    <ContentEditorMdx innerRef={ref} markdown={markdown} />
                </Section>
                <Section noHeader>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Button loading={!!loading} variant="contained" type="submit">
                            Save changes
                        </Button>
                        { error &&
                            <Typography sx={{ color: 'error.main' }}>
                                {error}
                            </Typography> }
                        { success &&
                            <Typography sx={{ color: 'success.main' }}>
                                {success}
                            </Typography> }
                    </Stack>
                </Section>
            </Stack>
        </FormContainer>
    );
}
