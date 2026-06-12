// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { render } from '@testing-library/react';
import { vi } from 'vitest';

import type { NavigationTopLevelItem } from './NavigationItem';
import { AccessControl } from '@lib/auth/AccessControl';
import { NavigationMenu } from './NavigationMenu';
import { NavigationMenuClient } from './NavigationMenuClient';

import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';

// Mock NavigationMenuClient so we can inspect the filtered items passed to it
vi.mock('./NavigationMenuClient', () => ({
    NavigationMenuClient: vi.fn(() => <div />),
}));

describe('NavigationMenu', () => {
    beforeEach(() => vi.clearAllMocks());

    function getPassedItems() {
        const mockCalls = vi.mocked(NavigationMenuClient).mock.calls;
        expect(mockCalls.length).toBe(1);

        return mockCalls[0][0].items as
            (NavigationTopLevelItem & { label: string })[];  // more concise tests
    }

    it('should keep items when condition is undefined or true, and filter out when false', () => {
        const access = new AccessControl({ /* no grants */ });
        const items: NavigationTopLevelItem[] = [
            {
                Icon: DashboardOutlinedIcon,
                label: 'Keep 1',
                url: '/keep1',
            },
            {
                Icon: DashboardOutlinedIcon,
                label: 'Keep 2',
                url: '/keep2',
                condition: true,
            },
            {
                Icon: DashboardOutlinedIcon,
                label: 'Filter 1',
                url: '/filter1',
                condition: false,
            },
        ];

        render(<NavigationMenu access={access} title="Test Title" items={items} />);

        const passed = getPassedItems();
        expect(passed).toHaveLength(2);
        expect(passed[0].label).toBe('Keep 1');
        expect(passed[1].label).toBe('Keep 2');
    });

    it('should filter items based on permissions', () => {
        const access = new AccessControl({
            grants: [ 'organisation.accounts' ],
        });

        const items: NavigationTopLevelItem[] = [
            {
                Icon: DashboardOutlinedIcon,
                label: 'Accounts (Granted)',
                url: '/accounts',
                permission: {
                    permission: 'organisation.accounts',
                    operation: 'read',
                },
            },
            {
                Icon: DashboardOutlinedIcon,
                label: 'Exports (Denied)',
                url: '/exports',
                permission: 'organisation.exports',
            },
        ];

        render(<NavigationMenu access={access} title="Test Title" items={items} />);

        const passed = getPassedItems();
        expect(passed).toHaveLength(1);
        expect(passed[0].label).toBe('Accounts (Granted)');
    });

    it('should support multiple permissions using OR logic (any of them)', () => {
        const access = new AccessControl({
            grants: [ 'organisation.teams' ],
        });

        const items: NavigationTopLevelItem[] = [
            {
                Icon: DashboardOutlinedIcon,
                label: 'Structure (Granted)',
                url: '/structure',
                permission: [
                    'organisation.environments',
                    'organisation.roles',
                    'organisation.teams',
                ],
            },
            {
                Icon: DashboardOutlinedIcon,
                label: 'Other Structure (Denied)',
                url: '/other-structure',
                permission: [
                    'organisation.environments',
                    'organisation.roles',
                ],
            },
        ];

        render(<NavigationMenu access={access} title="Test Title" items={items} />);

        const passed = getPassedItems();
        expect(passed).toHaveLength(1);
        expect(passed[0].label).toBe('Structure (Granted)');
    });

    it('should filter sub-items within sections and remove section if empty', () => {
        const access = new AccessControl({
            grants: [ 'organisation.accounts' ],
        });

        const items: NavigationTopLevelItem[] = [
            {
                header: 'Section 1 (Has items)',
                items: [
                    {
                        Icon: DashboardOutlinedIcon,
                        label: 'Accounts (Granted)',
                        url: '/accounts',
                        permission: {
                            permission: 'organisation.accounts',
                            operation: 'read',
                        },
                    },
                    {
                        Icon: DashboardOutlinedIcon,
                        label: 'Denied Item',
                        url: '/denied',
                        permission: 'organisation.exports',
                    },
                    {
                        Icon: DashboardOutlinedIcon,
                        label: 'False Condition',
                        url: '/false-condition',
                        condition: false,
                    },
                ],
            },
            {
                header: 'Section 2 (Empty section)',
                items: [
                    {
                        Icon: DashboardOutlinedIcon,
                        label: 'Denied Item 2',
                        url: '/denied2',
                        permission: 'organisation.exports',
                    },
                ],
            },
        ];

        render(<NavigationMenu access={access} title="Test Title" items={items} />);

        const passed = getPassedItems();
        expect(passed).toHaveLength(1);
        
        const section = passed[0];

        expect('header' in section).toBeTruthy();
        if ('header' in section) {
            expect(section.header).toBe('Section 1 (Has items)');
            expect(section.items).toHaveLength(1);
            expect(section.items[0].label).toBe('Accounts (Granted)');
        }
    });

    it('should filter out sections that initially contain no items', () => {
        const access = new AccessControl({ /* no grants */ });
        const items: NavigationTopLevelItem[] = [
            {
                header: 'Empty Section',
                items: [],
            },
        ];

        render(<NavigationMenu access={access} title="Test Title" items={items} />);

        const passed = getPassedItems();
        expect(passed).toHaveLength(0);
    });

    it('should remove sections where all items fail condition or permission checks', () => {
        const access = new AccessControl({ /* no grants */ });
        const items: NavigationTopLevelItem[] = [
            {
                header: 'Failing Section',
                items: [
                    {
                        Icon: DashboardOutlinedIcon,
                        label: 'Failing Condition',
                        url: '/failing-cond',
                        condition: false,
                    },
                    {
                        Icon: DashboardOutlinedIcon,
                        label: 'Failing Permission',
                        url: '/failing-perm',
                        permission: 'organisation.silent',
                    },
                ],
            },
        ];

        render(<NavigationMenu access={access} title="Test Title" items={items} />);

        const passed = getPassedItems();
        expect(passed).toHaveLength(0);
    });
});
