// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import TocIcon from '@mui/icons-material/Toc';

import { ContentEditor } from '@app/admin/system/content/ContentEditor';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGlobalScope } from '@app/admin/system/content/ContentScope';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tContent } from '@lib/database';

import { fetchContent, updateContent } from '@app/admin/system/content/ContentActions';

/**
 * The <ContentEntryPage> page displays an individual piece of content that can be edited by
 * the volunteer. The <ContentEditor> component takes care of the actual behaviour.
 */
export default async function ContentEntryPage(props: PageProps<'/admin/system/content/[id]'>) {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.content',
    });

    const params = await props.params;

    const contentId = parseInt(params.id, /* radix= */ 10);
    const contentTitle = await db.selectFrom(tContent)
        .where(tContent.contentId.equals(contentId))
            .and(tContent.revisionVisible.equals(/* true= */ 1))
        .selectOneColumn(tContent.contentTitle)
        .executeSelectNoneOrOne();

    if (!contentTitle)
        notFound();

    const scope = createGlobalScope();

    const fetchFn = fetchContent.bind(null, scope, contentId);
    const updateFn = updateContent.bind(null, scope, contentId);

    return (
        <>
            <Section icon={ <TocIcon color="primary" /> } title={contentTitle}
                     breadcrumbs={[
                         { label: 'Content', href: '/admin/system/content' },
                         { label: contentTitle },
                     ]}>
                <SectionIntroduction>
                    This page lists the global content of the Volunteer Portal such as the privacy
                    policy and various guides and e-mail templates.
                </SectionIntroduction>
            </Section>
            <ContentEditor fetchFn={fetchFn} updateFn={updateFn} noHeader />
        </>
    );
}

export const metadata: Metadata = {
    title: 'Content | AnimeCon Volunteer Manager',
};
