// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import { AnimeConClient, type AnimeConClientSettings } from './AnimeConClient';

describe('Client', () => {
    let fetches: { input: string, init: RequestInit }[] = [];
    let responses: { status: number, payload: any }[] = [];

    beforeEach(() => {
        fetches = [];
        responses = [];

        vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        expect(responses.length).toBeGreaterThan(0);
        expect(typeof input).toEqual('string');  // assumption

        fetches.push({
            input: input as string,
            init: init!
        });

        const response = responses.shift()!;
        return new Response(JSON.stringify(response.payload), {
            status: response.status,
        });
    }

    const kMockClientSettings: AnimeConClientSettings = {
        apiEndpoint: 'https://example.com/api',
        authEndpoint: 'https://example.com/auth',
        clientId: 'MY_ID',
        clientSecret: 'MY_SECRET',
        username: 'MY_USERNAME',
        password: 'MY_PASSWORD',
        scopes: 'MY_SCOPE'
    };

    const kMockAuthenticationResponse: typeof responses[number] = {
        status: 200,
        payload: {
            token_type: 'Bearer',
            access_token: '$ACCESS_TOKEN$',
            refresh_token: '$REFRESH_TOKEN$',
            expires_in: 3600
        },
    };

    it('will obtain an authentication token prior to making the api call', async () => {
        responses.push(kMockAuthenticationResponse);
        responses.push({ status: 200, payload: [ /* empty floors */ ] });

        const client = new AnimeConClient(kMockClientSettings);
        const response = await client.getFloors();

        expect(response).toEqual([]);

        expect(fetches.length).toEqual(2);
        const [ authFetch, apiFetch ] = fetches;

        expect(authFetch.input).toEqual(kMockClientSettings.authEndpoint);
        expect(authFetch.init.body).not.toBeUndefined();
        expect(authFetch.init.body + '').toEqual('[object FormData]');

        expect(apiFetch.input).toEqual(`${kMockClientSettings.apiEndpoint}/floors.json?`);
        expect(apiFetch.init.body).toBeUndefined();

        const headers = apiFetch.init.headers;

        expect(headers).not.toBeUndefined();
        expect(headers).toHaveLength(1);

        const [ headerName, headerValue ] = (headers as [ string, string ][])[0];

        expect(headerName).toEqual('Authorization');
        expect(headerValue).toEqual('Bearer $ACCESS_TOKEN$');
    });

    it('will request NextJS to cache both authentication and api calls', async () => {
        responses.push(kMockAuthenticationResponse);
        responses.push({ status: 200, payload: [ /* empty floors */ ] });

        const client = new AnimeConClient(kMockClientSettings);
        const response = await client.getFloors();

        expect(response).toEqual([]);

        expect(fetches.length).toEqual(2);
        const [ authFetch, apiFetch ] = fetches;

        expect(authFetch.init).not.toHaveProperty('cache');
        expect(authFetch.init).toHaveProperty('next.revalidate');
        expect(authFetch.init.next?.revalidate).toBeGreaterThan(0);

        expect(apiFetch.init).not.toHaveProperty('cache');
        expect(apiFetch.init).toHaveProperty('next.revalidate');
        expect(apiFetch.init.next?.revalidate).toBeGreaterThan(0);
    });

    it('is able to compose api call endpoints depending on the filters', async () => {
        responses.push(kMockAuthenticationResponse);
        responses.push({ status: 200, payload: [ /* empty timeslots */ ] });

        const client = new AnimeConClient(kMockClientSettings);
        const response = await client.getTimeslots({
            'dateStartsAt[after]': '2023-06-01',
            'dateEndsAt[before]': '2023-06-30',
        });

        expect(response).toEqual([]);

        expect(fetches.length).toEqual(2);
        expect(fetches[1].input).toEqual(
            `${kMockClientSettings.apiEndpoint}/timeslots.json?dateStartsAt%5Bafter%5D=2023-06-01` +
            '&dateEndsAt%5Bbefore%5D=2023-06-30');
    });

    it('is able to fetch and validate activities (getActivities())', async () => {
        responses.push(kMockAuthenticationResponse);
        responses.push({
            status: 200,
            payload: [
                {
                    'id': 42614,
                    'year': '202306',
                    'festivalId': 624,
                    'title': 'The Japanese Whisky Bar',
                    'sponsor': null,
                    'visible': true,
                    'reasonInvisible': null,
                    'spellChecked': false,
                    'maxVisitors': null,
                    'price': null,
                    'rules': 'rules',
                    'description': 'description',
                    'printDescription': null,
                    'webDescription': 'webDescription',
                    'socialDescription': null,
                    'url': 'https://animecon.nl/regular/en/program-list/24-taste-japan/397-the-japanese-whisky-bar',
                    'prizes': null,
                    'ticketsInfo': null,
                    'helpNeeded': false,
                    'activityType': {
                        'id': 805,
                        'description': 'Event 18+',
                        'longDescription': 'Event 18+',
                        'order': 110,
                        'visible': true,
                        'selectable': true,
                        'adultsOnly': true,
                        'competition': false,
                        'cosplay': false,
                        'event': true,
                        'gameRoom': false,
                        'video': false,
                        'cssClass': 'item',
                        'cssForegroundColor': '#FFFFFF',
                        'cssBackgroundColor': '#AF7817',
                        'cssBold': false,
                        'cssIsStrikeThrough': false
                    },
                    'timeslots': [
                        {
                            'id': 103910,
                            'dateStartsAt': '2023-06-09T22:00:00+00:00',
                            'dateEndsAt': '2023-06-10T01:00:00+00:00',
                            'activity': '/activities/42614',
                            'location': {
                                'id': 5345,
                                'year': 202306,
                                'name': 'Events 4: Food Workshops',
                                'useName': null,
                                'sponsor': null,
                                'area': 'Terrace',
                                'floorId': 376,
                            }
                        },
                        {
                            'id': 103911,
                            'dateStartsAt': '2023-06-10T21:30:00+00:00',
                            'dateEndsAt': '2023-06-11T01:00:00+00:00',
                            'activity': '/activities/42614',
                            'location': {
                                'id': 5345,
                                'year': 202306,
                                'name': 'Events 4: Food Workshops',
                                'useName': null,
                                'sponsor': null,
                                'area': 'Terrace',
                                'floorId': 376,
                            }
                        }
                    ],
                    'smallImage': null,
                    'largeImage': null
                },
            ]
        });

        const client = new AnimeConClient(kMockClientSettings);
        const response = await client.getActivities();

        expect(response).toHaveLength(1);
        expect(response[0].title).toEqual('The Japanese Whisky Bar');
    });

    it('is able to fetch and validate activity types (getActivityTypes())', async () => {
        responses.push(kMockAuthenticationResponse);
        responses.push({
            status: 200,
            payload: [
                {
                    'id': 800,
                    'description': 'Opening times',
                    'longDescription': 'Opening times',
                    'order': 20,
                    'visible': true,
                    'selectable': true,
                    'adultsOnly': false,
                    'competition': false,
                    'cosplay': false,
                    'event': false,
                    'gameRoom': false,
                    'video': false,
                    'cssClass': 'open',
                    'cssForegroundColor': '#000000',
                    'cssBackgroundColor': '#FED4C2',
                    'cssBold': false,
                    'cssIsStrikeThrough': false
                },
            ]
        });

        const client = new AnimeConClient(kMockClientSettings);
        const response = await client.getActivityTypes();

        expect(response).toHaveLength(1);
        expect(response[0].description).toEqual('Opening times');
    });

    it('is able to fetch and validate floors (getFloors())', async () => {
        responses.push(kMockAuthenticationResponse);
        responses.push({
            status: 200,
            payload: [
                {
                    name: 'Ground Floor',
                },
            ]
        });

        const client = new AnimeConClient(kMockClientSettings);
        const response = await client.getFloors();

        expect(response).toHaveLength(1);
        expect(response[0].name).toEqual('Ground Floor');
    });

    it('is able to fetch and valiate timeslots (getTimeslots())', async () => {
        responses.push(kMockAuthenticationResponse);
        responses.push({
            status: 200,
            payload: [
                {
                    'id': 103959,
                    'dateStartsAt': '2023-06-09T14:00:00+00:00',
                    'dateEndsAt': '2023-06-11T20:00:00+00:00',
                    'activity': {
                        'id': 42637,
                        'year': '202306',
                        'title': 'Lost & Found',
                        'sponsor': null,
                        'visible': false,
                        'reasonInvisible': 'niet in timeline!',
                        'spellChecked': false,
                        'maxVisitors': null,
                        'price': null,
                        'rules': null,
                        'description': 'description',
                        'printDescription': null,
                        'webDescription': 'webDescription',
                        'socialDescription': null,
                        'url': null,
                        'prizes': null,
                        'ticketsInfo': null,
                        'helpNeeded': false,
                        'activityType': {
                            'id': 815,
                            'description': 'Hidden Event',
                            'longDescription': 'This event is closed for the general public',
                            'order': 10,
                            'visible': false,
                            'selectable': true,
                            'adultsOnly': false,
                            'competition': false,
                            'cosplay': false,
                            'event': false,
                            'gameRoom': false,
                            'video': false,
                            'cssClass': 'item',
                            'cssForegroundColor': '#000000',
                            'cssBackgroundColor': '#CCCCFF',
                            'cssBold': true,
                            'cssIsStrikeThrough': false
                        },
                        'timeslots': [
                            '/timeslots/103959'
                        ],
                        'smallImage': null,
                        'largeImage': null
                    },
                    'location': {
                        'id': 5335,
                        'year': 20239,
                        'name': 'Bag room',
                        'useName': null,
                        'sponsor': null,
                        'area': 'Bakkerij 1',
                        'floorId': 271,
                    }
                }
            ]
        });

        const client = new AnimeConClient(kMockClientSettings);
        const response = await client.getTimeslots();

        expect(response).toHaveLength(1);
        expect(response[0].id).toEqual(103959);
    });
});
