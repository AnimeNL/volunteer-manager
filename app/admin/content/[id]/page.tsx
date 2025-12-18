// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { ContentEditor } from '@app/admin/content/ContentEditor';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGlobalScope } from '@app/admin/content/ContentScope';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The <ContentEntryPage> page displays an individual piece of content that can be edited by
 * the volunteer. The <ContentEditor> component takes care of the actual behaviour.
 */
export default async function ContentEntryPage(props: PageProps<'/admin/content/[id]'>) {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.content',
    });

    const params = await props.params;
    const scope = createGlobalScope();

    return (
        <ContentEditor contentId={parseInt(params.id, 10)} scope={scope} title="Page editor">
            <SectionIntroduction>
                You are updating <strong>global content</strong>, any changes you save will be
                published immediately.
            </SectionIntroduction>
        </ContentEditor>
    );
}

export const metadata: Metadata = {
    title: 'Content | AnimeCon Volunteer Manager',
};
