// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { Activity, ActivityType, FloorApi, Timeslot } from './AnimeConTypes';
import { kActivityDefinition, kActivityTypeDefinition, kFloorApiDefinition, kTimeslotDefinition }
    from './AnimeConTypes';

import { AnimeConAuth, type AnimeConAuthSettings } from './AnimeConAuth';

/**
 * Settings that must be provided to the AnimeCon Client. These are required towards making any
 * API call, regardless of event or parameters.
 */
export interface AnimeConClientSettings extends AnimeConAuthSettings {
    /**
     * Endpoint for the AnimeCon API that the Volunteer Portal communicates with.
     */
    apiEndpoint: string;
}

/**
 * Filters that can be provided in the `Client::issueRequest()` method.
 */
type Filters = Record<string, boolean | number | string>;

/**
 * Filters that may be provided in the `Client::getActivities()` method.
 */
type GetActivitiesFilters = {
    'activityType.visible'?: boolean;
    'festivalId'?: number;
    'title'?: string;  // partial match
    'visible'?: boolean;
    'year'?: string;  // exact match
};

/**
 * Filters that may be provided in the `Client::getTimeslots()` method.
 */
type GetTimeslotsFilters = {
    'dateStartsAt[before]'?: string;  // YYYY-MM-DD, exact match
    'dateStartsAt[after]'?: string;  // YYYY-MM-DD, exact match
    'dateEndsAt[before]'?: string;  // YYYY-MM-DD, exact match
    'dateEndsAt[after]'?: string;  // YYYY-MM-DD, exact match
    'activity.visible'?: boolean;
    'activity.activityType.visible'?: boolean;
    'activity.id'?: number;
    'activity.year'?: number;
    'location.id'?: number;
    'activity.activityType.id'?: number;
};

/**
 * Client for the AnimeCon Integration, loosely based on the official REST API Client.
 *
 * @see https://github.com/AnimeNL/php-rest-api-client
 * @see https://github.com/AnimeNL/php-rest-api-client/blob/master/src/AnimeConClient.php
 */
export class AnimeConClient {
    #apiEndpoint: string;
    #auth: AnimeConAuth;

    constructor(settings: AnimeConClientSettings) {
        const { apiEndpoint, ...authSettings } = settings;

        this.#apiEndpoint = apiEndpoint;
        this.#auth = new AnimeConAuth(authSettings);
    }

    /**
     * Returns the activities, optionally filtered based on the given `filters`. This will issue an
     * authenticated API call to the AnimeCon API endpoint.
     */
    async getActivities(filters?: GetActivitiesFilters): Promise<Activity[]> {
        const response = await this.issueRequest('activities.json', filters);
        return await z.array(kActivityDefinition).parseAsync(response);
    }

    /**
     * Returns the valid activity types, for which no filters are available. This will issue an
     * authenticated API call to the AnimeCon API endpoint.
     */
    async getActivityTypes(): Promise<ActivityType[]> {
        const response = await this.issueRequest('activity-types.json');
        return await z.array(kActivityTypeDefinition).parseAsync(response);
    }

    /**
     * Returns the floors, for which no filters are available. This will issue an authenticated API
     * call to the AnimeCon API endpoint.
     */
    async getFloors(): Promise<FloorApi[]> {
        const response = await this.issueRequest('floors.json');
        return await z.array(kFloorApiDefinition).parseAsync(response);
    }

    /**
     * Returns the timeslots, optionally filtered by the given `filters`. This is a very wasteful
     * API call as a lot of redundant activity information will be repeated throughout the response.
     * This will issue an authenticated API call to the AnimeCon API endpoint.
     */
    async getTimeslots(filters?: GetTimeslotsFilters): Promise<Timeslot[]> {
        const response = await this.issueRequest('timeslots.json', filters);
        return await z.array(kTimeslotDefinition).parseAsync(response);
    }

    /**
     * Actually issues an API request to the AnimeCon API endpoint. This method will ensure that a
     * valid JWT token is available, and then issue the request to obtain the response.
     */
    private async issueRequest(relativePath: string, filters?: Filters): Promise<any[]> {
        const authenticationToken = await this.#auth.authenticate();
        if (!authenticationToken)
            throw new Error('Unable to obtain an authentication token from the AnimeCon server.');

        const urlParameters = new URLSearchParams();
        if (filters !== undefined) {
            for (const [ key, value ] of Object.entries(filters))
                urlParameters.set(key, `${value}`);
        }

        const url = `${this.#apiEndpoint}/${relativePath}?${urlParameters.toString()}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: [
                [ 'Authorization', `Bearer ${authenticationToken.token}`],
            ],
            next: {
                revalidate: /* seconds= */ 300,
            }
        });

        if (!response.ok)
            throw new Error(`Unable to call into the AnimeCon API (${response.statusText})`);

        return await response.json();
    }
}
