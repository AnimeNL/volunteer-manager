// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ChangeCircleOutlinedIcon from '@mui/icons-material/ChangeCircleOutlined';
import HotelIcon from '@mui/icons-material/Hotel';
import RepeatIcon from '@mui/icons-material/Repeat';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';

import type * as prompts from '@lib/ai/prompts';

/**
 * Displays one of the prompt icons. This is implemented as a client component as Next.js somehow
 * managed to optimise away the icon, which is not the intended effect.
 */
export function PromptIcon(props: { id: keyof typeof prompts }) {
    switch (props.id) {
        case 'ApplicationApprovedPrompt':
            return <ThumbUpOutlinedIcon color="primary" />;

        case 'ApplicationRejectedPrompt':
            return <ThumbDownOutlinedIcon color="primary" />;

        case 'HotelConfirmationPrompt':
            return <HotelIcon color="primary" />;

        case 'ParticipationCancelledPrompt':
            return <CancelOutlinedIcon color="primary" />;

        case 'ParticipationReinstatedPrompt':
            return <SettingsBackupRestoreIcon color="primary" />;

        case 'ParticipationReminderPrompt':
            return <RepeatIcon color="primary" />;

        case 'TeamChangePrompt':
            return <ChangeCircleOutlinedIcon color="primary" />;

        // -----------------------------------------------------------------------------------------

        case 'NardoPersonalisedAdvicePrompt':
        case 'SystemPrompt':
            break;
    }
}
