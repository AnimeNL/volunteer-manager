// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { MobileAppBar } from './MobileAppBar';

let currentPathname = '/admin';
const mockUsePathname = vi.fn(() => currentPathname);

vi.mock('next/navigation', () => ({
    usePathname: () => mockUsePathname(),
}));

describe('MobileAppBar', () => {
    beforeEach(() => {
        currentPathname = '/admin';
        vi.clearAllMocks();
    });

    const defaultProps = {
        menu: <div data-testid="menu-content">Menu Content</div>,
        slotProps: {
            sidebar: {
                enableOrganisation: true,
                events: [
                    { concluded: false, label: 'Event 2026', slug: 'event-2026' }
                ],
            },
        },
    };

    it('should open the drawer when clicking the menu button, and close when pathname changes by default', async () => {
        const { rerender } = render(<MobileAppBar {...defaultProps} />);

        // Drawer is closed initially
        expect(screen.queryByTestId('menu-content')).toBeNull();

        // Open the drawer by finding the MenuIcon button
        const menuButton = screen.getByTestId('MenuIcon').closest('button')!;
        fireEvent.click(menuButton);

        // Drawer is open
        expect(screen.getByTestId('menu-content')).toBeDefined();

        // Simulate a pathname change from page content link navigation (e.g. from /admin to
        // /dmin/some-page)
        currentPathname = '/admin/some-page';
        rerender(<MobileAppBar {...defaultProps} />);

        // Drawer should close (wait for transition/unmount)
        await waitFor(() => {
            expect(screen.queryByTestId('menu-content')).toBeNull();
        });
    });

    it('should NOT close the drawer when navigating via clicking an entry in NavigationSidebar', async () => {
        const { rerender } = render(<MobileAppBar {...defaultProps} />);

        // Open the drawer
        const menuButton = screen.getByTestId('MenuIcon').closest('button')!;
        fireEvent.click(menuButton);

        // Find and click the "Organisation" sidebar button via its link href in the document body
        const organisationButton = document.body.querySelector('a[href="/admin/organisation"]')!;
        expect(organisationButton).not.toBeNull();
        fireEvent.click(organisationButton);

        // Simulate the pathname change triggered by this click (to /admin/organisation)
        currentPathname = '/admin/organisation';
        rerender(<MobileAppBar {...defaultProps} />);

        // Drawer should remain open
        expect(screen.getByTestId('menu-content')).toBeDefined();

        // Now simulate another pathname change not from the sidebar (e.g. from /admin/organisation
        // to /admin/organisation/details)
        currentPathname = '/admin/organisation/details';
        rerender(<MobileAppBar {...defaultProps} />);

        // Drawer should close (wait for transition/unmount)
        await waitFor(() => {
            expect(screen.queryByTestId('menu-content')).toBeNull();
        });
    });
});
