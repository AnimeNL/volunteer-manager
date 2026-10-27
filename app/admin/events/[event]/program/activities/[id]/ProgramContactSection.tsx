// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { CommunicationIconButton } from '@app/admin/components/CommunicationDialog';
import { ContactSection } from '@app/admin/components/ContactSection';

import { sendCommunicationToActivityOwner } from '../../ProgramActions';

/**
 * Props accepted by the <ProgramContactSection> component.
 */
interface ProgramContactSectionProps {
    /**
     * Activity for which the owner can be contacted.
     */
    activity: {
        id: number;
        title: string;
    };

    /**
     * Event in which the activity takes place.
     */
    event: {
        id: number;
        shortName: string;
    };

    /**
     * Name of the activity owner whom to send a communication to.
     */
    name: string;
}

/**
 * Component through which contact can be conveniently established with a program activity's owner.
 */
export function ProgramContactSection(props: ProgramContactSectionProps) {
    const { activity, event, name } = props;

    return (
        <ContactSection name={name}>
            <CommunicationIconButton
                title={`Reach out to ${name}?`}
                action={sendCommunicationToActivityOwner.bind(null, event.id, activity.id)}
                color="inherit"
                disableSilent
                language={undefined}
                promptId="program-activity-check-in"
                promptParams={{
                    activityId: activity.id,
                    eventId: event.id,
                }}>

                Send <strong>{name}</strong> a message regarding{' '}
                <strong>{activity.title}</strong> at {event.shortName}.

            </CommunicationIconButton>
        </ContactSection>
    );
}
