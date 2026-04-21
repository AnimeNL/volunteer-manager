// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Image from 'next/image';
import { useContext, useMemo } from 'react';
import useSWR from 'swr';

import Card from '@mui/material/Card';
import Collapse from '@mui/material/Collapse';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Markdown } from '@components/Markdown';
import { ScheduleContext } from '../ScheduleContext';
import { callApi } from '@lib/callApi';
import { currentTimestamp, toZonedDateTime } from '../CurrentTime';
import { formatDate } from '@lib/Temporal';

/**
 * Fetching function that retrieves advice from the network.
 */
function adviceFetcherFn(advice?: string, context?: string[], event?: string) {
    return async (url: string) => {
        if (url !== '/api/nardo/personalised')
            throw new Error('You forgot to update the advice endpoint');

        if (!advice || !context?.length || !event)
            return undefined;

        const response = await callApi('post', '/api/nardo/personalised', {
            row: {
                context,
                contextAdvice: advice,
                contextEvent: event,
            },
        });

        if (!response.success)
            return 'Something went wrong';

        return response.row.output;
    };
}

/**
 * The <AdviceContainer> component fetches the most recent advice from the server. This may take a
 * little while given that it's generated in real time, so a loading interface is included as well.
 */
export function AdviceContainer() {
    const { schedule } = useContext(ScheduleContext);

    const [ advice, context, event ] = useMemo(() => {
        const advice = schedule?.nardo;
        const context: string[] = [ /* no context yet */ ];
        const event = schedule?.slug;

        if (!!schedule && !!advice) {
            const currentTime = currentTimestamp();
            if (schedule.volunteers.hasOwnProperty(`${schedule.userId}`)) {
                const volunteer = schedule.volunteers[`${schedule.userId}`];
                for (const scheduledShiftId of volunteer.schedule) {
                    const scheduledShift = schedule.schedule[scheduledShiftId];
                    if (scheduledShift.end < currentTime)
                        continue;  // this shift has already ended

                    const shift = schedule.shifts[scheduledShift.shift];
                    const activity = schedule.program.activities[shift.activity];

                    let location: string = /* default= */ 'Volunteer Lounge';
                    for (const timeslotId of activity.timeslots) {
                        const timeslot = schedule.program.timeslots[timeslotId];
                        const timeslotLocation = schedule.program.locations[timeslot.location];

                        location = timeslotLocation.name;
                    }

                    if (scheduledShift.start < currentTime) {
                        const endZonedDateTime = toZonedDateTime(scheduledShift.end);
                        const end = formatDate(endZonedDateTime, '');

                        context.push(
                            `They are currently on the "${shift.name}" shift, taking place in ` +
                            `the ${location}. It is due to end on ${end}.`);

                    } else {
                        const startZonedDateTime = toZonedDateTime(scheduledShift.start);
                        const start = formatDate(startZonedDateTime, '');

                        context.push(
                            `They are next scheduled on the "${shift.name}" shift, taking place ` +
                            `in the ${location}. It is due to start on ${start}.`);
                    }

                    break;  // only include the first current or upcoming shift
                }

                if (!context.length) {
                    if (!volunteer.schedule.length) {
                        context.push('Their shifts are a surprise; none have been scheduled yet.');
                    } else {
                        context.push(
                            'They finished all of their shifts, and have helped us out ' +
                            'tremendously well. Maybe emphasise that?');
                    }
                }
            } else {
                context.push(
                    'They are a volunteer, but have not signed up to participate in any of ' +
                    'our teams yet. Maybe remind them that they should?');
            }
        }

        return [ advice, context, event ];

    }, [ schedule ]);

    const { data } = useSWR(
        !!advice ? '/api/nardo/personalised' : null,
        adviceFetcherFn(advice, context, event),
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        });

    return (
        <Card sx={{ p: 2 }}>
            <Collapse in={!data}>
                <Stack spacing={2} sx={{ alignItems: 'center', paddingY: 2 }}>
                    <Image src="/images/advice.png" alt="Del a Rie Advies Logo"
                           height={128} width={175} />
                    <Typography sx={{ textAlign: 'center', textWrap: 'balance' }}>
                        We've received your request for personal advice, and one of our advisors is
                        already crafting a personalised plan just for you! Sit tight — we'll be
                        sending it your way shortly!
                    </Typography>
                    <LinearProgress color="primary" sx={{ alignSelf: 'stretch' }} />
                </Stack>
            </Collapse>
            <Collapse in={!!data}>
                <Markdown>{data}</Markdown>
                <Typography sx={{ pt: 2, textAlign: 'end' }}>
                    — with love, Del a Rie Advies
                </Typography>
            </Collapse>
        </Card>
    );
}
