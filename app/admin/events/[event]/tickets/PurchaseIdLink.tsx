// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Typography from '@mui/material/Typography';

/**
 * Props accepted by the <PurchaseIdLink> component.
 */
interface PurchaseIdLinkProps {
    /**
     * External URL to the ticketing partner's order page, if available.
     */
    href?: string;

    /**
     * Formatted purchase ID label to display.
     */
    label: string | number;
}

/**
 * Renders a purchase ID alongside an optional external link to the ticketing partner's order page.
 */
export function PurchaseIdLink(props: PurchaseIdLinkProps) {
    return (
        <Typography variant="body2" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            {props.label}
            { !!props.href &&
                <MuiLink component={Link} href={props.href} target="_blank"
                         sx={{ display: 'inline-flex', alignItems: 'center' }}>
                    <OpenInNewIcon fontSize="inherit" />
                </MuiLink> }
        </Typography>
    );
}
