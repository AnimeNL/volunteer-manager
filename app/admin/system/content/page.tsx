// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import TocIcon from '@mui/icons-material/Toc';

import { ContentCreate } from './ContentCreate';
import { ContentList } from './ContentList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '../../components/SectionIntroduction';
import { createContent } from './ContentActions';
import { createGlobalScope } from './ContentScope';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The <ContentPage> component lists the global content, which then, in turn, may be edited and
 * deleted as applicable. This includes the privacy policy, e-mail messages, and so on.
 */
export default async function ContentPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.content',
    });

    const scope = createGlobalScope();

    const createFn = createContent.bind(null, scope);

    return (
        <>
            <Section icon={ <TocIcon color="primary" /> } title="Pages"
                     breadcrumbs={[ { label: 'Content' } ]}>
                <SectionIntroduction>
                    This page lists the global content of the Volunteer Portal such as the privacy
                    policy and various guides and e-mail templates.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <ContentList scope={scope} />
            </Section>
            <Section title="Create a new page">
                <SectionIntroduction>
                    You can create new <strong>global content</strong>. These pages will however not
                    automatically be published, and rely on code changes.
                </SectionIntroduction>
                <ContentCreate createFn={createFn} />
            </Section>
        </>
    );
}

export const metadata: Metadata = {
    title: 'Content | AnimeCon Volunteer Manager',
};
