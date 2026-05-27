// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import BedIcon from '@mui/icons-material/Bed';
import CampaignIcon from '@mui/icons-material/Campaign';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ChangeCircleOutlinedIcon from '@mui/icons-material/ChangeCircleOutlined';
import DrawIcon from '@mui/icons-material/Draw';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import HelpIcon from '@mui/icons-material/Help';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import HotelIcon from '@mui/icons-material/Hotel';
import RepeatIcon from '@mui/icons-material/Repeat';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';

import type { PromptIdByType } from '@lib/ai/PromptFactory';

/**
 * Displays one of the prompt icons. This is implemented as a client component as Next.js somehow
 * managed to optimise away the icon, which is not the intended effect.
 */
export function PromptIcon(props: { id: PromptIdByType<any> }) {
    switch (props.id) {
        // -----------------------------------------------------------------------------------------
        // Communication:
        // -----------------------------------------------------------------------------------------

        case 'application-approved':
            return <ThumbUpOutlinedIcon color="primary" />;

        case 'application-rejected':
            return <ThumbDownOutlinedIcon color="primary" />;

        case 'event-dates-announced':
            return <CampaignIcon color="primary" />;

        case 'event-hotels-announced':
            return <HotelIcon color="primary" />;

        case 'event-trainings-announced':
            return <HistoryEduIcon color="primary" />;

        case 'hotel-confirmation':
            return <BedIcon color="primary" />;

        case 'participation-cancelled':
            return <CancelOutlinedIcon color="primary" />;

        case 'participation-reinstated':
            return <SettingsBackupRestoreIcon color="primary" />;

        case 'participation-reminder':
            return <RepeatIcon color="primary" />;

        case 'team-change':
            return <ChangeCircleOutlinedIcon color="primary" />;

        // -----------------------------------------------------------------------------------------
        // Features:
        // -----------------------------------------------------------------------------------------

        case 'duty-book-summary-prompt':
            return <SummarizeOutlinedIcon color="primary" />;

        case 'incident-summary-prompt':
            return <FlagOutlinedIcon color="primary" />;

        case 'personality-description-prompt':
            return <DrawIcon color="primary" />;

        // -----------------------------------------------------------------------------------------
        // Internal:
        // -----------------------------------------------------------------------------------------

        case 'nardo-personalised-advice':
        case 'system-prompt':
            break;
    }

    return <HelpIcon color="primary" />;
}
