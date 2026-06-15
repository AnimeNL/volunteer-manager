// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { useContext } from 'react';

import { default as MuiBreadcrumbs } from '@mui/material/Breadcrumbs';
import { default as MuiLink } from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { AdminClientContext } from '@app/admin/AdminClientContext';

/**
 * Props accepted by the <SectionBreadcrumbs> component.
 */
export interface SectionBreadcrumbsProps {
    /**
     * Breadcrumbs to display together with the page they should link to.
     */
    breadcrumbs: {
        /**
         * URL that this breadcrumb should link to, if any.
         */
        href?: string;

        /**
         * Label to represent this specific page.
         */
        label: string;

    }[];
}

/**
 * The <SectionBreadcrumbs> component enables the user to quickly navigate in the page hierarchy on
 * desktop devices, without having to use the menu.
 */
export function SectionBreadcrumbs(props: SectionBreadcrumbsProps) {
    const { isLayoutV2, isMobile } = useContext(AdminClientContext);
    if (!isLayoutV2 || isMobile)
        return null;  // breadcrumbs are only shown on desktop

    if (!props.breadcrumbs.length)
        return null;  // there are no breadcrumbs to show

    return (
        <Breadcrumbs separator="›">
            { props.breadcrumbs.map(({ href, label }, index) =>
                !!href ? <MuiLink key={index} component={Link} href={href}
                                  color="inherit" underline="hover" variant="body2">
                             {label}
                         </MuiLink>
                       : <Typography key={index} variant="body2">
                             {label}
                         </Typography> )}
        </Breadcrumbs>
    );
}

/**
 * Variant of the <Breadcrumbs> component with minimal styling to meet our requirements.
 */
const Breadcrumbs = styled(MuiBreadcrumbs)(({ theme }) => ({
    borderBottom: `1px solid ${theme.vars?.palette.divider}`,
    marginBottom: theme.spacing(1.5),
    marginTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(1),
}));
