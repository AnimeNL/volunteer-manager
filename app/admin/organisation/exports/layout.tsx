// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import DvrIcon from '@mui/icons-material/Dvr';
import Paper from '@mui/material/Paper';
import ShareIcon from '@mui/icons-material/Share';

import { NavigationTabs, type NavigationTabsProps } from '@app/admin/components/NavigationTabs';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The <OrganisationExportsLayout> is the layout surrounding the Data Export functionality. This
 * set of pages encapsulates the ability for GDPR-compliant data exports to be created for a set
 * of predetermined reasons.
 */
export default async function OrganisationExportsLayout(
    props: LayoutProps<'/admin/organisation/exports'>)
{
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'organisation.exports',
    });

    // ---------------------------------------------------------------------------------------------
    // Determine the tabs that the signed in user has access to
    // ---------------------------------------------------------------------------------------------

    const tabs: NavigationTabsProps['tabs'] = [
        {
            icon: <ShareIcon />,
            label: 'Export data',
            url: '/admin/organisation/exports/create',
            urlMatchMode: 'prefix',
        },
        {
            icon: <DvrIcon />,
            label: 'Logs',
            url: '/admin/organisation/exports',
        },

    ];

    // ---------------------------------------------------------------------------------------------

    return (
        <>
            <Section icon={ <AccountBalanceIcon color="primary" /> } title="Data exports"
                     documentation="organisation/exports">
                <SectionIntroduction>
                    This page lets you generate a GDPR-compliant data export when it is necessary to
                    share volunteering data with third parties.
                </SectionIntroduction>
            </Section>
            <Paper>
                <NavigationTabs tabs={tabs} />
                <Divider />
                <Box sx={{ p: 2 }}>
                    {props.children}
                </Box>
            </Paper>
        </>
    );
}
