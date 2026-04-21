// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography, { type TypographyProps } from '@mui/material/Typography';

import type { BooleanPermission, CRUDPermission } from '@lib/auth/Access';
import { DocumentationButton } from './DocumentationButton';

/**
 * Props accepted by the <SectionHeader> component.
 */
export interface SectionHeaderProps {
    /**
     * Topic for which a documentation action should be shown.
     */
    documentation?: string;

    /**
     * Action that should be shown on the end side of the header.
     */
    headerAction?: React.ReactNode;

    /**
     * The icon that should be shown in the section's header, if any.
     */
    icon?: React.ReactNode;

    /**
     * The permission behind which this feature has been gated.
     */
    permission?: BooleanPermission | CRUDPermission;

    /**
     * Title of this section. Required.
     */
    title: string;

    /**
     * Subtitle to contextualize the header, displayed immediately adjacent to the title. Optional.
     */
    subtitle?: string;

    /**
     * The system prop that allows defining system overrides as well as additional CSS styles.
     */
    sx?: TypographyProps['sx'],
}

/**
 * The <SectionHeader> component represents the heading part of a section, contextualizing what the
 * section is about, who can access it, and how it can be modified.
 *
 * While this component avoids the need for client-side JavaScript, actions can be passed that do
 * require them, to enable interaction such as a clear button.
 */
export function SectionHeader(props: SectionHeaderProps) {
    return (
        <Stack direction="row" sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '-8px !important',
            ...props.sx
        }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                {props.icon}
                <Typography variant="h5">
                    { props.title }
                    { props.subtitle &&
                        <Typography component="span" variant="h5"
                                    sx={{ color: 'action.active', paddingLeft: 1 }}>
                            ({ props.subtitle })
                        </Typography> }
                </Typography>
            </Stack>
            {props.headerAction}
            { !!props.documentation &&
                <Box sx={{ my: -0.5 }}>
                    <DocumentationButton color="info" size="medium" topic={props.documentation} />
                </Box> }
        </Stack>
    );
}
