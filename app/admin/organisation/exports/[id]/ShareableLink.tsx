// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useCallback, useState } from 'react';

import { default as MuiLink } from '@mui/material/Link';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Snackbar from '@mui/material/Snackbar';

/**
 * Props accepted by the <ShareableLink> component.
 */
interface ShareableLinkProps {
    /**
     * URL that the link should point to.
     */
    href: string;
}

/**
 * The <ShareableLink> component displays a link that will be copied to the clipboard when selected,
 * as opposed to opened in the broader.
 */
export function ShareableLink(props: ShareableLinkProps) {
    const [ copied, setCopied ] = useState<boolean>(false);

    const handleCopyLinkAcknowledged = useCallback(() => setCopied(false), [ /* no deps */ ]);
    const handleCopyLink = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        navigator.clipboard.writeText(props.href);
        setCopied(true);
    }, [ props.href ]);

    return (
        <>
            <MuiLink component={Link} href={'#'} onClick={handleCopyLink}>
                {props.href} <ContentCopyIcon sx={{ ml: .5 }} fontSize="inherit" />
            </MuiLink>
            <Snackbar open={copied} onClose={handleCopyLinkAcknowledged}
                      autoHideDuration={2000} message="Link copied to your clipboard" />
        </>
    );
}
