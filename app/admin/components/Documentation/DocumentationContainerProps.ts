// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Props accepted by the <DocumentationDialog> and <DocumentationDrawer> components.
 */
export interface DocumentationContainerProps {
    /**
     * Whether the drawer is open.
     */
    open: boolean;

    /**
     * Callback that will be invoked when the drawer should be closed.
     */
    onClose: () => void;

    /**
     * Title to display for the documentation.
     */
    title: string;

    /**
     * The Markdown content of the documentation, if successfully loaded.
     */
    content: string | undefined;

    /**
     * The error message if loading the documentation failed.
     */
    error: string | undefined;
};
