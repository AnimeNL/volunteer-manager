// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { PlaceholderPage } from '../components/PlaceholderPage';

/**
 * Placeholder Knowledge base page for `app/schedule2/[slug]/knowledge`.
 */
export default function Schedule2KnowledgePage(props: PageProps<'/schedule2/[slug]/knowledge'>) {
    return <PlaceholderPage params={props.params} title="Knowledge base" />;
}

export const instant = true;
export const prefetch = 'partial';
