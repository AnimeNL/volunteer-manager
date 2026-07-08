// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Alert from '@mui/material/Alert';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import StorageIcon from '@mui/icons-material/Storage';
import Typography from '@mui/material/Typography';

import { LocalDateDuration } from '@app/admin/components/LocalDateDuration';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { getQueryLog } from '@lib/database/Connection';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * Internal page that displays information about the database. This page is only available on local
 * builds, as tracking all executing database queries is deemed too invasive on production.
 */
export default async function DatabasePage() {
    await requireAuthenticationContext({ check: 'admin', permission: 'root' });
    return (
        <>
            <Section icon={ <StorageIcon color="primary" /> } title="Database"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Database' },
                     ]}>
                <SectionIntroduction>
                    Insight in the queries that are being executed on the database. Only the latest
                    {' '}{process.env.APP_DATABASE_QUERY_LOG} queries will be stored.
                </SectionIntroduction>
                <Alert severity="warning" variant="outlined">
                    This is an invasive capability that should only be enabled on local and staging
                    environments.
                </Alert>
            </Section>
            <Section noHeader>
                <List dense disablePadding>
                    { getQueryLog().map((query, index) =>
                        <ListItem key={index} divider disableGutters>
                            <ListItemIcon>
                                <ArrowRightIcon />
                            </ListItemIcon>
                            <ListItemText primary={query.query}
                                          slotProps={{
                                              primary: {
                                                  sx: { fontFamily: 'monospace', },
                                              }
                                          }}  />
                            <Typography variant="body2" sx={{ flexShrink: 0, ml: 2 }}
                                        color="textDisabled">
                                <LocalDateDuration
                                    dateTime={query.timestamp.toZonedDateTimeISO('UTC').toString()}
                                />
                            </Typography>
                        </ListItem> )}
                </List>
            </Section>
        </>
    );
}
