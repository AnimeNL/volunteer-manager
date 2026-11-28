// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Cache } from '@lib/cache';
import { SetRecordErrorLogDeferDelegate } from '@lib/ErrorLog';
import { buildAuthenticationContext } from '@lib/auth/AuthenticationTestHelpers';
import { useMockConnection } from '@lib/database/Connection';

import { updateTeam } from './TeamsActions';

const mockInvalidateCache = vi.fn();

vi.mock('next/headers', () => ({
    headers: async () => new Headers(),
}));

vi.mock('@lib/cache', async importOriginal => {
    const actual = await importOriginal<typeof import('@lib/cache')>();
    return {
        ...actual,
        invalidateCache: (...args: unknown[]) => {
            mockInvalidateCache(...args);
            return (actual.invalidateCache as (...a: unknown[]) => void)(...args);
        },
    };
});

vi.mock('@lib/auth', async importOriginal => {
    const actual = await importOriginal<typeof import('@lib/auth')>();

    const buildAdminContext = () => buildAuthenticationContext({
        access: {
            grants: [ 'event.visible', 'organisation.teams' ],
            events: '*',
            teams: '*',
        },
        user: {
            id: 42,
            firstName: 'Admin',
            lastName: 'User',
            name: 'Admin User',
            nameOrFirstName: 'Admin',
            username: 'admin@animecon.nl',
        },
    });

    return {
        ...actual,
        getAuthenticationContext: async () => buildAdminContext(),
        requireAuthenticationContext: async () => buildAdminContext(),
    };
});

vi.mock('@lib/log', () => ({
    LogBuilder: {
        for: () => {
            const builder = {
                withCondition: () => builder,
                withInitiatorUser: () => builder,
                withSeverity: () => builder,
                record: vi.fn(),
            };
            return builder;
        },
    },
}));

function buildUpdateTeamInput(visibleTeamIds: number[]) {
    return {
        colorDarkMode: '#112233',
        colorLightMode: '#445566',
        description: 'Crew team description',
        department: 'Operations',
        environment: 1,
        name: 'Crew',
        plural: 'Crew',
        title: 'Crew Team',
        emailAccountId: 1,

        defaultRoleId: 1,
        availableRoleIds: [ 1, 2 ],
        visibleTeamIds,

        flagEnableDutyBook: false,
        flagEnableScheduling: true,
        flagGrowthCharts: true,
        flagManagesContent: false,
        flagManagesFaq: false,
        flagManagesFirstAid: false,
        flagManagesSecurity: false,
        flagProgramRequests: false,
        flagRequestConfirmation: false,
    };
}

describe('TeamsActions', () => {
    const mockConnection = useMockConnection();

    beforeEach(() => {
        mockInvalidateCache.mockReset();
        Cache.getInstance('EventState').clear();
        SetRecordErrorLogDeferDelegate(async () => undefined);
    });

    afterEach(() => {
        SetRecordErrorLogDeferDelegate(undefined);
    });

    it('persists deduplicated directional visibleTeamIds without self-references', async () => {
        const visibilityInsertParams: unknown[] = [];
        const markDirty = vi.fn();
        Cache.getInstance('EventState').set(7, {
            markDirty,
            markVolunteerDirty: vi.fn(),
            resetBoundaryHours: vi.fn(),
        } as any);

        mockConnection.expect('beginTransaction', () => undefined);
        mockConnection.expect('update', () => 1);
        mockConnection.expect('delete', () => 2);
        mockConnection.expect('insert', () => 2);
        mockConnection.expect('delete', () => 0);
        mockConnection.expect('insert', (_query, params) => {
            visibilityInsertParams.push(...params);
            return 2;
        });
        mockConnection.expect('commit', () => undefined);

        const result = await updateTeam(1, buildUpdateTeamInput([ 1, 2, 3, 2 ]));

        expect(result).toEqual({ success: true, refresh: true });
        expect(visibilityInsertParams).toEqual([ 1, 2, 1, 3 ]);
        expect(mockInvalidateCache).toHaveBeenCalledWith('team', { teamId: 1 });
        expect(markDirty).toHaveBeenCalledWith('teams');
    });

    it('clears existing team visibility rows without inserting when visibleTeamIds is empty',
        async () => {
            const markDirty = vi.fn();
            Cache.getInstance('EventState').set(7, {
                markDirty,
                markVolunteerDirty: vi.fn(),
                resetBoundaryHours: vi.fn(),
            } as any);

            mockConnection.expect('beginTransaction', () => undefined);
            mockConnection.expect('update', () => 1);
            mockConnection.expect('delete', () => 2);
            mockConnection.expect('insert', () => 2);
            mockConnection.expect('delete', () => 1);
            mockConnection.expect('commit', () => undefined);

            const result = await updateTeam(1, buildUpdateTeamInput([]));

            expect(result).toEqual({ success: true, refresh: true });
            expect(mockInvalidateCache).toHaveBeenCalledWith('team', { teamId: 1 });
            expect(markDirty).toHaveBeenCalledWith('teams');
        });
});
