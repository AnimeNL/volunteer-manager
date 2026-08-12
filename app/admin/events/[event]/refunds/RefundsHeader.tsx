// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import type { PageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';

/**
 * Props accepted by the <RefundsHeader> component.
 */
interface RefundsHeaderProps {
    /**
     * Whether the signed in volunteer has the ability to export this information.
     */
    enableExport?: boolean;

    /**
     * Information about the event for which refunds are being displayed.
     */
    event: PageInfo['event'];
}

/**
 * The <RefundsHeader> component displays the page the user is on together with a share button.
 */
export function RefundsHeader(props: RefundsHeaderProps) {
    const { event } = props;

    const router = useRouter();
    const handleExportButton = useCallback(() => {
        router.push('/admin/organisation/exports/create');
    }, [ router ])

    // TODO: onExport={!!props.enableExport ? handleExportButton : undefined}

    return (
        <Section title="Refund requests">
            <SectionIntroduction>
                Volunteers can request their ticket to be refunded, which involves sharing financial
                information. Access to these requests and settings is
                <strong> need to know</strong>.
            </SectionIntroduction>
        </Section>
    );
}
