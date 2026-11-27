// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';

/**
 * Individual volunteer entry displayed in a team roster.
 */
export interface VolunteerSummary {
    /**
     * Name of the shift the volunteer is currently performing, if any.
     */
    activeShift?: string;

    /**
     * Optional avatar image URL.
     */
    avatar?: string;

    /**
     * Unique volunteer user ID used for `/volunteers/[id]` links.
     */
    id: number;

    /**
     * Whether the volunteer's active shift is a Backup shift (available to help).
     */
    isBackup?: boolean;

    /**
     * Full display name of the volunteer.
     */
    name: string;

    /**
     * Assigned role name (e.g. "Steward", "Senior Steward", "Staff").
     */
    role: string;

    /**
     * Whether the assigned role represents team leadership or senior staff.
     */
    roleLeader?: boolean;

    /**
     * Formatted local return time (`HH:mm`), or `'indefinite'` when the volunteer is not expected
     * to return during the event. Omitted when the volunteer is available.
     */
    unavailableUntil?: string;
}

/**
 * Team summary displayed on the `/volunteers` hub page.
 */
export interface VolunteerTeamSummary {
    /**
     * Number of volunteers currently on shift (including Backup shifts).
     */
    activeCount: number;

    /**
     * First names of volunteers currently on shift, ordered alphabetically.
     */
    activeFirstNames: string[];

    /**
     * Team accent colour (mock stand-in for the database-stored team colour).
     */
    colour: string;

    /**
     * Whether the signed-in volunteer belongs to this team.
     */
    isUserTeam: boolean;

    /**
     * Display name of the team.
     */
    name: string;

    /**
     * URL slug identifying the team in `/volunteers/teams/[team]`.
     */
    slug: string;

    /**
     * Total number of volunteers assigned to this team.
     */
    totalCount: number;
}

/**
 * Full team detail including its roster of volunteers.
 */
export interface VolunteerTeamDetail extends VolunteerTeamSummary {
    volunteers: VolunteerSummary[];
}

/**
 * Raw mock team definition used to derive both hub summaries and team spoke rosters.
 */
interface MockTeamRecord {
    colour: string;
    isUserTeam: boolean;
    name: string;
    slug: string;
    volunteers: VolunteerSummary[];
}

const kMockTeams: MockTeamRecord[] = [
    {
        slug: 'stewards',
        name: 'Stewards',
        colour: '#689f38',
        isUserTeam: true,
        volunteers: [
            {
                id: 101,
                name: 'Alice Hengst',
                role: 'Steward',
                activeShift: 'Backup',
                isBackup: true,
            },
            { id: 102, name: 'Aranka Wesseling', role: 'Senior Steward', roleLeader: true },
            { id: 103, name: 'Ben Phillips', role: 'Steward', activeShift: 'Banzai no Ushi' },
            { id: 104, name: 'Berber Tolboom', role: 'Steward', activeShift: 'Hentai Voice Over' },
            {
                id: 105,
                name: 'Eva Janssen',
                role: 'Steward',
                activeShift: 'Backup',
                isBackup: true,
            },
            {
                id: 106,
                name: 'Ferdi van der Werf',
                role: 'Staff',
                roleLeader: true,
                activeShift: 'Heat Blasters',
            },
            {
                id: 107,
                name: 'Giovanni Carini',
                role: 'Senior Steward',
                roleLeader: true,
                activeShift: 'Banzai no Ushi',
            },
            { id: 108, name: 'Hanan Tahiri', role: 'Steward', activeShift: 'Game Room' },
            {
                id: 109,
                name: 'Ibrahim Chamy',
                role: 'Steward',
                activeShift: 'Japanese Aged Distilled Spirits Tasting 18+',
            },
            { id: 110, name: 'Jaleesa Vaessen', role: 'Steward' },
            { id: 111, name: 'Jim Kaiser', role: 'Steward' },
            { id: 112, name: 'Marco Drost', role: 'Steward', activeShift: 'Banzai no Ushi' },
            { id: 113, name: 'Melissa Oliemeulen', role: 'Senior Steward', roleLeader: true },
            { id: 114, name: 'Nardo de la Rie', role: 'Staff', roleLeader: true },
            { id: 115, name: 'Sanne Bakker', role: 'Steward', unavailableUntil: 'indefinite' },
            { id: 116, name: 'Tim Vermeer', role: 'Steward', unavailableUntil: '14:30' },
        ],
    },
    {
        slug: 'bag-room-crew',
        name: 'Bag Room Crew',
        colour: '#795548',
        isUserTeam: false,
        volunteers: [
            { id: 201, name: 'Lars Willems', role: 'Bag Room Crew', activeShift: 'Check-in Desk' },
            { id: 202, name: 'Vera Jacobs', role: 'Bag Room Crew' },
        ],
    },
    {
        slug: 'crew',
        name: 'Crew',
        colour: '#f57c00',
        isUserTeam: false,
        volunteers: [
            {
                id: 301,
                name: 'Bram Jansen',
                role: 'Senior Crew',
                roleLeader: true,
                activeShift: 'Stage Setup',
            },
            { id: 302, name: 'Koen Vos', role: 'Crew', activeShift: 'Logistics' },
            { id: 303, name: 'Sophie Mulder', role: 'Crew' },
            { id: 304, name: 'Thijs Dekker', role: 'Crew' },
        ],
    },
    {
        slug: 'crew-care',
        name: 'Crew Care',
        colour: '#c2185b',
        isUserTeam: false,
        volunteers: [
            {
                id: 401,
                name: 'Eline Smit',
                role: 'Senior Crew Care',
                roleLeader: true,
                activeShift: 'Crew Lounge',
            },
            { id: 402, name: 'Maud Peeters', role: 'Crew Care', activeShift: 'Catering' },
            { id: 403, name: 'Yara Brouwer', role: 'Crew Care' },
        ],
    },
    {
        slug: 'events-crew',
        name: 'Events Crew',
        colour: '#7b1fa2',
        isUserTeam: false,
        volunteers: [
            {
                id: 501,
                name: 'Lucas Bos',
                role: 'Events Lead',
                roleLeader: true,
                activeShift: 'Main Hall',
            },
            { id: 502, name: 'Noa van Dijk', role: 'Events Crew', activeShift: 'Cosplay Prep' },
            { id: 503, name: 'Stijn Kok', role: 'Events Crew' },
        ],
    },
    {
        slug: 'game-room-crew',
        name: 'Game Room Crew',
        colour: '#00897b',
        isUserTeam: false,
        volunteers: [
            {
                id: 601,
                name: 'Jesse de Boer',
                role: 'Game Room Lead',
                roleLeader: true,
                activeShift: 'Console Desk',
            },
            { id: 602, name: 'Mila Schouten', role: 'Game Room Crew' },
        ],
    },
    {
        slug: 'hosts',
        name: 'Hosts',
        colour: '#0288d1',
        isUserTeam: false,
        volunteers: [
            {
                id: 701,
                name: 'Anouk Meijer',
                role: 'Senior Host',
                roleLeader: true,
                activeShift: 'Info Desk',
            },
            { id: 702, name: 'Daan de Vries', role: 'Host', activeShift: 'Main Entrance' },
            {
                id: 703,
                name: 'Lotte Visser',
                role: 'Host',
                activeShift: 'Backup',
                isBackup: true,
            },
            { id: 704, name: 'Niels Kuiper', role: 'Host' },
            { id: 705, name: 'Roos Hendriks', role: 'Host' },
        ],
    },
];

/**
 * Extracts the first name from a volunteer's display name for concise hub summaries.
 */
function getFirstName(fullName: string): string {
    return fullName.split(' ')[0] ?? fullName;
}

/**
 * Builds a `VolunteerTeamSummary` from a raw team record.
 */
function buildTeamSummary(record: MockTeamRecord): VolunteerTeamSummary {
    const activeVolunteers = record.volunteers
        .filter(volunteer => !!volunteer.activeShift && !volunteer.unavailableUntil)
        .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

    return {
        activeCount: activeVolunteers.length,
        activeFirstNames: activeVolunteers.map(volunteer => getFirstName(volunteer.name)),
        colour: record.colour,
        isUserTeam: record.isUserTeam,
        name: record.name,
        slug: record.slug,
        totalCount: record.volunteers.length,
    };
}

/**
 * Returns mock volunteer team summaries ordered alphabetically by team name.
 */
export async function getMockVolunteerTeams(): Promise<VolunteerTeamSummary[]> {
    return kMockTeams
        .map(buildTeamSummary)
        .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
}

/**
 * Returns mock volunteer team detail and roster for the requested team `slug`, or `undefined` if
 * no matching team exists.
 */
export async function getMockVolunteerTeamDetail(
    slug: string): Promise<VolunteerTeamDetail | undefined>
{
    const record = kMockTeams.find(team => team.slug === slug);
    if (!record)
        return undefined;

    const volunteers = [ ...record.volunteers ]
        .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

    return {
        ...buildTeamSummary(record),
        volunteers,
    };
}
