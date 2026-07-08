// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import CakeIcon from '@mui/icons-material/Cake';

import { BirthdayCalendar } from './BirthdayCalendar';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { queryBirthdays } from './queryBirthdays';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * Overview page that shows a calendar listing all birthdays that the signed in user has access to.
 */
export default async function BirthdayOverviewPage() {
    const { access } = await requireAuthenticationContext({ check: 'admin' });

    const birthdays = await queryBirthdays(access);
    const filteredBirthdays = birthdays.map(({ id, name, birthday }) => ({
        id, name,
        birthday: birthday.with({ year: 1998 }).toString(),
    }));

    return (
        <>
            <Section icon={ <CakeIcon color="primary" /> } title="Birthday calendar"
                     breadcrumbs={[ { label: 'Birthday calendar' }]}>
                <SectionIntroduction>
                    Annual calendar of our volunteers' birthdays.
                </SectionIntroduction>
            </Section>
            <BirthdayCalendar birthdays={filteredBirthdays} />
        </>
    );
}
