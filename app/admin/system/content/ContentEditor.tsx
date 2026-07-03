// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

import type { MDXEditorMethods } from '@mdxeditor/editor';
import { type FieldValues, FormContainer, SelectElement, TextFieldElement }
    from '@proxy/react-hook-form-mui';

import type { ValueOptions } from '@mui/x-data-grid-premium';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import type { ContentRowModel } from './ContentDataSource';
import type { SectionHeaderProps } from '../../components/SectionHeader';
import type { ServerActionResult } from '@lib/serverAction';
import { Section } from '../../components/Section';
import { Temporal, formatDate } from '@lib/Temporal';
import { validateContentPath } from './ContentCreate';

import '@mdxeditor/editor/style.css';

/**
 * Dynamically import the ContentEditorMdx component. Disable server-side rendering as that leads to
 * an hydration error in the NextJS app router.
 */
const ContentEditorMdx = dynamic(() => import('./ContentEditorMdx'), { ssr: false });

/**
 * Props directly accepted by the <ContentEditor> component.
 */
interface ContentEditorOwnProps {
    /**
     * Categories that can be assigned to the editor. Will be ignored when absent.
     */
    categories?: ValueOptions[];

    /**
     * Server Action through which the content can be fetched.
     */
    fetchFn: () => Promise<ServerActionResult>;

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
     * Server Action through which the content can be updated.
     */
    updateFn: (row: { categoryId?: number; content: string; path?: string; title: string; })
        => Promise<ServerActionResult>;
}

/**
 * Composited props accepted by the editor.
 */
type ContentEditorProps =
    (ContentEditorOwnProps & SectionHeaderProps) |
    (ContentEditorOwnProps & { noSections: true });

/**
 * The <ContentEditor> component is a fully functional content editor, built upon an MDX editor that
 * provides near-WYSIWYG editing capabilities. The editor will be lazily loaded to not contribute
 * to the bundle size, while still being available when it needs to be.
 */
export function ContentEditor(props: React.PropsWithChildren<ContentEditorProps>) {
    const { categories, children, fetchFn, pathHidden, pathPrefix, updateFn, ...sectionHeaderProps }
        = props;

    const ref = useRef<MDXEditorMethods>(null);
    const useSections = !('noSections' in props);

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

            const response = await updateFn({
                categoryId: data.categoryId ?? undefined,
                content: ref.current.getMarkdown(),
                path: data.path ?? defaultValues?.path,
                title: data.title,
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
    }, [ defaultValues, updateFn ]);

    const [ contentProtected, setContentProtected ] = useState<boolean>(false);
    const [ markdown, setMarkdown ] = useState<string>();

    useEffect(() => {
        fetchFn().then(response => {
            if (!response.success) {
                setError(response.error ?? 'Unable to load the content from the server');
                return;
            }

            setDefaultValues({
                ...response.row,
                updatedOn:
                    formatDate(
                        Temporal.ZonedDateTime.from(response.row.updatedOn),
                        'YYYY-MM-DD[T]HH:mm:ss[Z]'),
            });

            setContentProtected(!!response.row.protected);
            setMarkdown(response.row.content);
        });
    }, [ fetchFn ]);

    const SectionComponent =
        useSections ? Section as React.ElementType
                    : React.Fragment;

    if (!defaultValues) {
        return (
            <SectionComponent {...sectionHeaderProps}>
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
            </SectionComponent>
        );
    }

    return (
        <FormContainer defaultValues={defaultValues} onSuccess={handleSave}>
            <Stack direction="column" spacing={2}>
                <SectionComponent {...sectionHeaderProps}>
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
                </SectionComponent>
                { !useSections &&
                    <Divider sx={{ pt: 1, mb: 2 }} /> }
                <SectionComponent noHeader>
                    <MdxEditorContainer>
                        <ContentEditorMdx innerRef={ref} markdown={markdown} />
                    </MdxEditorContainer>
                </SectionComponent>
                { !useSections &&
                    <Divider sx={{ marginTop: '8px !important' }} /> }
                <SectionComponent noHeader>
                    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
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
                </SectionComponent>
            </Stack>
        </FormContainer>
    );
}

/**
 * Wrapper for the MDX editor through which we apply styling to the component, ensuring that it has
 * consistent and appropriate appearance for both our dark and light modes.
 */
const MdxEditorContainer = styled(Box)(({ theme }) => ([
    {
        '& .cm-editor': {
            marginTop: theme.spacing(0.5),
            borderRadius: theme.shape.borderRadius,
            overflow: 'hidden',
        },
        '& .mdxeditor': {
            '--baseTextContrast': theme.vars?.palette.text.primary,
            fontSize: theme.typography.body2.fontSize,
        },
    },
    theme.applyStyles('dark', {
        '& .cm-activeLineGutter': {
            backgroundColor: theme.vars?.palette.background.default,
        },
        '& .cm-editor': {
            backgroundColor: theme.vars?.palette.background.paper,
            color: theme.vars?.palette.text.primary,
        },
        '& .cm-gutters': {
            color: theme.vars?.palette.grey[600],
        },
        '& .mdxeditor': {
            '--baseBase': theme.vars?.palette.background.paper,
            '--baseBg': theme.vars?.palette.background.default,
            '--baseBgActive': theme.vars?.palette.grey[700],
        },
    }),
    theme.applyStyles('light', {
        '& .mdxeditor': {
            '--baseBgActive': theme.vars?.palette.grey[300],
        },
    }),
]));
