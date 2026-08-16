// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

// -------------------------------------------------------------------------------------------------
// NOTE:
// Different from other files in this component, the <MarkdownContainer> prop is fine to use in
// client components. It ensures that the right font size is used throughout the output.
// -------------------------------------------------------------------------------------------------

import type { TypographyVariant } from '@mui/material/styles';
import Stack from '@mui/material/Stack';

/**
 * Base typography variants supported by the <Markdown> renderer.
 */
export type MarkdownVariants = Extract<TypographyVariant, 'body1' | 'body2'>;

/**
 * Props accepted by the <MarkdownContainer> component.
 */
export interface MarkdownContainerProps {
    /**
     * Base typography variant to apply.
     * @default "body1"
     */
    variant?: MarkdownVariants;
}

/**
 * Font size mappings for the supported typography variants.
 */
const kFontSizeMapping: { [k in MarkdownVariants]: string } = {
    body1: '1rem',
    body2: '0.875rem',
};

/**
 * Container that can hold Markdown content.
 */
export function MarkdownContainer(props: React.PropsWithChildren<MarkdownContainerProps>) {
    const variant = props.variant ?? 'body1';
    return (
        <Stack direction="column" spacing={2} sx={{ fontSize: kFontSizeMapping[variant] }}>
            {props.children}
        </Stack>
    );
}
