// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import DvrIcon from '@mui/icons-material/Dvr';
import ShareIcon from '@mui/icons-material/Share';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * Layout of the data export feature, setting context for page tabulation.
 */
export default async function OrganisationExportsLayout(
    props: LayoutProps<'/admin/organisation/exports'>)
{
    const { access } = await requireAuthentication('organisation.exports');

    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: ShareIcon,
                label: 'Export data',
                url: '/admin/organisation/exports/create',
                urlMatchMode: 'strict',
            },
            {
                Icon: DvrIcon,
                label: 'Logs',
                url: '/admin/organisation/exports',
                urlMatchMode: 'strict',
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
