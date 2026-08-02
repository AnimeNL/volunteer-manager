// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import InputLabel from '@mui/material/InputLabel';
import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';

import { useIsMobile } from '@app/admin/lib/useIsMobile';

/**
 * Props accepted by the <ActionBar> component.
 */
interface ActionBarProps {
    /**
     * Label to display at the top of the action bar.
     * @default "Quick actions"
     */
    label?: string;
}

/**
 * The <ActionBar> component contains a set of actions available to the signed in user, but without
 * needing extensive dedicated UI of their own. It's expected to contain a set of buttons that will
 * be layed out automatically in a responsive manner.
 */
export function ActionBar(props: React.PropsWithChildren<ActionBarProps>) {
    const isMobile = useIsMobile();
    return (
        <ActionBarContainer>
            <ActionBarInputLabel shrink variant="outlined">
                { props.label || 'Quick actions' }
            </ActionBarInputLabel>
            <ActionBarStack direction={ isMobile ? 'column' : 'row' } spacing={1.5}>
                {props.children}
            </ActionBarStack>
        </ActionBarContainer>
    );
}

/**
 * Container for the <ActionBar> component. Styled in line with input elements.
 */
const ActionBarContainer = styled('div')(({ theme }) => ({
    border: `1px solid rgba(${theme.vars?.palette.common.onBackgroundChannel} / 0.23)`,
    borderRadius: theme.shape.borderRadius,
}));

/**
 * Input label, carefully positioned over the outlined container. Background colour fixed to the one
 * used for paper elements.
 */
const ActionBarInputLabel = styled(InputLabel)(({ theme }) => ({
    backgroundColor: theme.vars?.palette.background.paper,
    backgroundImage: theme.vars?.overlays[1],
    padding: theme.spacing(0, 0.5),
    margin: theme.spacing(0, -0.5),
    width: 'fit-content',
}));

/**
 * Stack, with adjusted spacing to match expectations.
 */
const ActionBarStack = styled(Stack)(({ theme }) => ({
    color: `color-mix(in srgb, ${theme.vars?.palette.text.primary} 75%, transparent)`,
    padding: theme.spacing(0, 1.5, 1.5, 1.5),
    marginTop: theme.spacing(-1),
}));
