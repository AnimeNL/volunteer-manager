// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';
import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import MyLocationIcon from '@mui/icons-material/MyLocation';

import { KeyValueList } from '@app/admin/components/KeyValueList';
import { LogsDataTable } from '../../logs/LogsDataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SectionLoading } from '@app/admin/components/SectionLoading';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { ip2location } from '@lib/ip2location';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * Overview page for IP address diagnostics, providing the ability to look up addresses.
 */
export default async function IpPage(props: PageProps<'/admin/system/diagnostics/ip/[ip]'>) {
    await requireAuthenticationContext({
            check: 'admin',
            permission: {
                permission: 'system.logs',
                operation: 'read',
            },
        });

    const ip = (await props.params).ip;

    return (
        <>
            <Section icon={ <MyLocationIcon color="primary" /> } title={ip}
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Diagnostics', href: '/admin/system/diagnostics' },
                         { label: 'IP Addresses', href: '/admin/system/diagnostics/ip' },
                         { label: ip },
                     ]}>
                <SectionIntroduction>
                    Information and analytics about their activity on the Volunteer Manager.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <Suspense fallback={ <SectionLoading /> }>
                    <IpLocationSection ipAddress={ip} />
                </Suspense>
            </Section>
            <Section noHeader>
                <LogsDataTable ipAddress={ip} pageSize={25} />
            </Section>
        </>
    );
}

/**
 * Queries and displays information about the location and environment associated with the given
 * `ip`. This relies on an external service, and thus is a suspended component.
 */
async function IpLocationSection(props: { ipAddress: string }) {
    const metadata = await ip2location(props.ipAddress);
    if (!metadata) {
        return (
            <Alert severity="warning" variant="outlined">
                Location information for <strong>{props.ipAddress}</strong> is not available.
            </Alert>
        );
    }

    let googleMapsLink: string | undefined;
    if (!!metadata.latitude && !!metadata.longitude) {
        googleMapsLink =
            `https://www.google.com/maps/place/${metadata.latitude},${metadata.longitude}`;
    }

    return (
        <KeyValueList items={[
            {
                key: 'IP Address',
                value: props.ipAddress,
            },
            {
                condition: !!metadata.country_name,
                key: 'Country',
                value: `${metadata.country_name} (${metadata.country_code})`
            },
            {
                condition: !!metadata.region_name,
                key: 'Region',
                value: metadata.region_name,
            },
            {
                condition: !!metadata.city_name,
                key: 'City',
                value: metadata.city_name,
            },
            {
                condition: !!googleMapsLink,
                key: 'Coordinates',
                value: (
                    <MuiLink component={Link} target="_blank" href={googleMapsLink!}>
                        {`${metadata.latitude}, ${metadata.longitude}`}
                    </MuiLink>
                ),
            },
            {
                condition: !!metadata.zip_code,
                key: 'Zip code',
                value: metadata.zip_code,
            },
            {
                condition: !!metadata.time_zone,
                key: 'Timezone',
                value: metadata.time_zone,
            }
        ]} />
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'ip' }, 'IP Addresses', 'Diagnostics', 'System');
