// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

import { fetchRemoteContent } from './MarkdownRemoteActions';

/**
 * Props accepted by the <MarkdownRemoteContent> component.
 */
interface MarkdownRemoteContentProps {
    /**
     * Identifier that clarifies what content should be fetched.
     */
    id: string;
}

/**
 * Component that dynamically fetches remote content based on a given identifier.
 */
export function MarkdownRemoteContent(props: MarkdownRemoteContentProps) {
    const [ content, setContent ] = useState<React.ReactNode | undefined>();
    const [ error, setError ] = useState<string | undefined>();

    useEffect(() => {
        fetchRemoteContent({ id: props.id }).then(response => {
            if (response.success)
                setContent(response.markdown);
            else
                setError(response.error || 'Unable to inject remote content, fetch failed');
        }).catch(error => {
            setError(error.message || 'Unable to inject remote content, exception thrown');
        });
    }, [ props.id ]);

    return (
        <>
            { (!!content) && <Box>{content}</Box> }
            { (!content && !error) &&
                <Box>
                    <Skeleton variant="text" animation="wave" width="80%" height={6} />
                    <Skeleton variant="text" animation="wave" width="88%" height={6} />
                    <Skeleton variant="text" animation="wave" width="83%" height={6} />
                </Box> }
            { (!content && !!error) &&
                <Alert severity="error" variant="outlined">
                    {error}
                </Alert> }
        </>
    );
}
