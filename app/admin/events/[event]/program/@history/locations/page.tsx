// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { default as MuiLink } from '@mui/material/Link';

import { ProgramHistory } from '../ProgramHistory';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';

export default function ProgramLocationsHistorySlot() {
    return (
        <Section title="Recent changes" subtitle="locations">
            <SectionIntroduction>
                This table summarises changes made to <strong>locations</strong> across the
                Volunteer Portal and <MuiLink href="https://anplan.animecon.nl/">AnPlan</MuiLink>,
                the official AnimeCon planning tool.
            </SectionIntroduction>
            <ProgramHistory context={{ event: '2026', festivalId: 627 }} />
        </Section>
    );
}
