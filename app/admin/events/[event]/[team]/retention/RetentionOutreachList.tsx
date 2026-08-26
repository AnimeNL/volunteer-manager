// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';

import { KeyValueList } from '@app/admin/components/KeyValueList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';

/**
 * Props accepted by the <RetentionOutreachList> component.
 */
interface RetentionOutreachListProps {
    /**
     * Array of the assigned volunteers that are still on this person's to-do list to conclude.
     */
    assignedVolunteers: {
        id: number;
        name: string;
        email?: string;
        phoneNumber?: string;
    }[];
}

/**
 * The <RetentionOutreachList> component displays the list of volunteers that the signed in user is
 * expected to reach out to. It mentions their contact information, and has some shortcut buttons to
 * conveniently progress the state of the outreach.
 */
export function RetentionOutreachList(props: RetentionOutreachListProps) {
    if (!props.assignedVolunteers.length)
        return null;

    return (
        <Section icon={ <AssignmentTurnedInOutlinedIcon /> } title="Your outreach tasks" highlight>
            <SectionIntroduction>
                Contact the volunteers on this list to invite them to participate again, including
                in other teams.
            </SectionIntroduction>
            <KeyValueList items={props.assignedVolunteers.map(volunteer => {
                const contactDetails: string[] = [];
                if (volunteer.email)
                    contactDetails.push(volunteer.email);
                if (volunteer.phoneNumber)
                    contactDetails.push(volunteer.phoneNumber);

                return {
                    key: volunteer.name,
                    value: contactDetails.length ? contactDetails.join(' · ')
                                                 : 'No contact information available',
                };
            })} />
        </Section>
    );
}
