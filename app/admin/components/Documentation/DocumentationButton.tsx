// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useState } from 'react';

import { useQueryState } from 'nuqs';

import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import { DocumentationDialog } from './DocumentationDialog';
import { DocumentationDrawer } from './DocumentationDrawer';
import { useIsMobile } from '@app/admin/lib/useIsMobile';

import { fetchDocumentation } from './DocumentationActions';

/**
 * Props accepted by the <DocumentationButton> component.
 */
interface DocumentationButtonProps {
    /**
     * Title of the documentation to be presented to the user.
     */
    title: string;

    /**
     * Documentation topic that should be displayed when the button is activated.
     */
    topic: string;
}

/**
 * The <DocumentationButton> component is a MUI <IconButton> that will load specific documentation
 * when activated, to be displayed in a manner appropriate for responsive display.
 *
 * State of the documentation view is controlled using Nuqs, so that people are able to share links
 * with the documentation view opened in their browser.
 */
export function DocumentationButton(props: DocumentationButtonProps) {
    const isMobile = useIsMobile();

    const [ activeTopic, setActiveTopic ] = useQueryState('documentation', {
        history: 'push',  // enable a back navigation to close the documentation
    });

    const [ content, setContent ] = useState<string | undefined>(undefined);
    const [ error, setError ] = useState<string | undefined>(undefined);
    const [ loading, setLoading ] = useState<boolean>(false);

    const handleCloseDocumentation = useCallback(() => {
        setActiveTopic(null);
    }, [ setActiveTopic ]);

    const handleOpenDocumentation = useCallback(() => {
        setActiveTopic(props.topic);
    }, [ setActiveTopic, props.topic ]);

    const open = activeTopic === props.topic;

    useEffect(() => {
        if (!open || content || error || loading)
            return;

        const fetchDocumentationFromServer = async () => {
            setLoading(true);
            try {
                const response = await fetchDocumentation(props.topic);
                response.success ? setContent(response.content)
                                 : setError(response.error ?? 'Unable to load the documentation');

            } catch (error: any) {
                setError(error.message ?? 'Unable to load the documentation');
            } finally {
                setLoading(false);
            }
        };

        fetchDocumentationFromServer();

    }, [ open, content, error, loading, props.topic ]);

    return (
        <>
            <Tooltip title="Documentation">
                <IconButton onClick={handleOpenDocumentation} loading={loading}>
                    <HelpOutlineOutlinedIcon color="action"
                                             sx={{ visibility: loading ? 'hidden' : 'visible' }} />
                </IconButton>
            </Tooltip>
            { !!isMobile &&
                <DocumentationDialog open={open}
                                     onClose={handleCloseDocumentation}
                                     content={content}
                                     error={error}
                                     title={props.title} /> }
            { !isMobile &&
                <DocumentationDrawer open={open}
                                     onClose={handleCloseDocumentation}
                                     content={content}
                                     error={error}
                                     title={props.title} /> }
        </>
    );
}
