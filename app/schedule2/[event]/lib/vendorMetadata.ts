// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { SvgIconComponent } from '@mui/icons-material';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';

import type { IconBadgeTone } from '../components/IconBadge';
import type { VendorTeam } from '@lib/database/Types';

import { kVendorTeam } from '@lib/database/Types';

/**
 * Full 24-hour natural height (89px day header + 24 * 46px hour rows, plus buffer) so the
 * three-day vendor schedule grid renders without an internal scrollbar.
 */
export const kVendorCalendarHeightPx = 1225;

/**
 * Display and route metadata for each supported vendor team.
 */
export const kVendorMetadata: Record<VendorTeam, {
    description: string;
    icon: SvgIconComponent;
    title: string;
    tone: IconBadgeTone;
}> = {
    [kVendorTeam.FirstAid]: {
        description: 'On-site schedule for First Aid personnel.',
        icon: LocalHospitalOutlinedIcon,
        title: 'First Aid',
        tone: 'error',
    },
    [kVendorTeam.Security]: {
        description: 'On-site schedule for Security personnel.',
        icon: ShieldOutlinedIcon,
        title: 'Security',
        tone: 'info',
    },
};

/**
 * Validates `team` as a known `VendorTeam` slug, returning `undefined` otherwise.
 */
export function parseVendorTeam(team: string): VendorTeam | undefined {
    if (team === kVendorTeam.FirstAid || team === kVendorTeam.Security)
        return team;

    return undefined;
}
