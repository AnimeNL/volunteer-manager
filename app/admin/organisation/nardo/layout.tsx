// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import RecommendIcon from '@mui/icons-material/Recommend';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';

import { SectionTabContext } from '@app/admin/components/SectionTabContext'
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The <NardoLayout> is the layout wrapper that provides navigation for the Del a Rie Advies section
 * of the Volunteer Manager. A couple of tabs are included.
 */
export default async function NardoLayout(props: LayoutProps<'/admin/organisation/nardo'>) {
    const { access } = await requireAuthenticationContext({
        check: 'admin',
        permission: 'organisation.nardo',
    });

    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: TipsAndUpdatesIcon,
                label: 'Advice',
                url: '/admin/organisation/nardo',
                urlMatchMode: 'strict',
            },
            {
                Icon: RecommendIcon,
                label: 'Personalised advice',
                url: '/admin/organisation/nardo/personalised',
                urlMatchMode: 'prefix',
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
