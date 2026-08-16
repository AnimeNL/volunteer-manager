// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';

import { MarkdownContainer, type MarkdownContainerProps } from './MarkdownContainer';
import { markdownToJsx } from './markdownToJsx';

/**
 * Props accepted by the <Markdown> component.
 */
export interface MarkdownProps extends MarkdownContainerProps {
    /**
     * The Markdown content that should be rendered in the component.
     */
    content: string;
}

/**
 * The <Markdown> component renders a given content to a JSX tree. Due to the complexity of this
 * operation (~120 KiB uncompressed JavaScript) we exclusively want to do this on the server,
 */
export async function Markdown(props: MarkdownProps) {
    const { content, ...markdownContainerProps } = props;

    const contentJsx = await markdownToJsx(content);
    return (
        <MarkdownContainer {...markdownContainerProps}>
            {contentJsx}
        </MarkdownContainer>
    );
}
