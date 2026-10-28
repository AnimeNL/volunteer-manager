// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Alert from '@mui/material/Alert';

import type { Activity, ActivityType, FloorApi, Timeslot }
    from '@lib/integrations/animecon/AnimeConTypes';
import type { AnimeConClient } from '@lib/integrations/animecon/AnimeConClient';

import TextField from '@mui/material/TextField';

/**
 * Festival Id filter to apply to the `activities` endpoint.
 */
const kActivitiesFestivalIdFilter = /* AnimeCon 2024= */ 625;

/**
 * Year filter to apply to the `timeslots` endpoint.
 */
const kTimeslotsYearFilter = 2024;

/**
 * Whether the results should be filtered for the purpose of being used as test results, as we make
 * sure that our parsers continue to work with old festival information.
 */
const kFilterForTestResults = true;

/**
 * Props accepted by the <AnimeConStreamingApiResult> component.
 */
interface AnimeConStreamingApiResultProps {
    /**
     * The client through which the API can be accessed.
     */
    client: AnimeConClient;

    /**
     * Endpoint of the API call to issue to the AnimeCon API.
     */
    endpoint: 'activities.json' | 'activity-types.json' | 'floors.json' | 'timeslots.json';
}

/**
 * The <AnimeConStreamingApiResult> component issues an API call to the AnimeCon API and will
 * display the API's results in an autosizing textarea.
 */
export async function AnimeConStreamingApiResult(props: AnimeConStreamingApiResultProps) {
    const { client, endpoint } = props;

    let stringifiedResult: string | undefined;
    try {
        let result: Activity[] | ActivityType[] | FloorApi[] | Timeslot[];
        switch (endpoint) {
            case 'activities.json':
                result = await client.getActivities({
                    festivalId: kActivitiesFestivalIdFilter,
                });

                if (!!kFilterForTestResults) {
                    result = result.map(activity => ({
                        ...activity,
                        printDescription: null,
                    })).slice(0, 25);
                }

                break;

            case 'activity-types.json':
                result = await client.getActivityTypes();
                break;

            case 'floors.json':
                result = await client.getFloors();
                break;

            case 'timeslots.json':
                result = await client.getTimeslots({ 'activity.year': kTimeslotsYearFilter });
                break;

            default:
                throw new Error('Endpoint not recognised by the Volunteer Manager');
        }

        stringifiedResult = JSON.stringify(
            result, /* replacer= */ undefined, /* space= */ kFilterForTestResults ? undefined : 4);

    } catch (error: any) {
        return (
            <Alert severity="error">
                Unable to request the <strong>{props.endpoint}</strong> API: {error.message}
            </Alert>
        );
    }

    return (
        <TextField multiline fullWidth size="small" minRows={3} maxRows={16}
                   value={stringifiedResult} />
    );
}
