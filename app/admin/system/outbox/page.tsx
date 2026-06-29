// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import Grid from '@mui/material/Grid';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import TextsmsOutlinedIcon from '@mui/icons-material/TextsmsOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

import { OverviewPageTile } from '../page';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';

/**
 * Overview page for the Outbox, providing an alternative to the tab switcher on each page. Primary
 * reason for existence is to enable linkability in breadcrumbs.
 */
export default async function OutboxPage() {
    return (
        <>
            <Section icon={ <OutboxOutlinedIcon color="primary" /> } title="Outbox"
                     breadcrumbs={[
                         { label: 'Communication', href: '/admin/system/communication' },
                         { label: 'Outbox' },
                     ]}>
                <SectionIntroduction>
                    Collection of pages that provide insight to messages sent through the portal.
                </SectionIntroduction>
            </Section>
            <Grid container spacing={2}>
                <OverviewPageTile Icon={MailOutlinedIcon} href="/admin/system/outbox/email"
                                  label="E-mail" />
                <OverviewPageTile Icon={TextsmsOutlinedIcon} href="/admin/system/outbox/sms"
                                  label="SMS" />
                <OverviewPageTile Icon={WhatsAppIcon} href="/admin/system/outbox/whatsapp"
                                  label="WhatsApp" />
            </Grid>
        </>
    );
}

export const metadata: Metadata = {
    title: 'Outbox | AnimeCon Volunteer Manager',
};
