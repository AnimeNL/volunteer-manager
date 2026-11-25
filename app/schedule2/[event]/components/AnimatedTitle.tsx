// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Typography from '@mui/material/Typography';
import { keyframes, styled } from '@mui/material/styles';

/**
 * Subtle vertical crossfade keyframes for header title transitions.
 */
const kTitleExitKeyframes = keyframes`
    from {
        opacity: 1;
        transform: translateY(0);
    }
    to {
        opacity: 0;
        transform: translateY(-4px);
    }
`;

const kTitleEnterKeyframes = keyframes`
    from {
        opacity: 0;
        transform: translateY(4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

/**
 * Container for the crossfading dock title text.
 */
const TitleContainer = styled(Typography)({
    flexGrow: 1,
    fontSize: '0.9375rem',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    minWidth: 0,
    overflow: 'hidden',
    position: 'relative',
}) as typeof Typography;

/**
 * Single-line title span supporting static, entering, and exiting transition phases.
 */
const TitleText = styled('span', {
    shouldForwardProp: prop => prop !== 'phase',
})<{ phase: 'static' | 'enter' | 'exit' }>({
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',

    variants: [
        {
            props: { phase: 'enter' },
            style: {
                animation: `${kTitleEnterKeyframes} 160ms cubic-bezier(0.2, 0, 0, 1) 100ms both`,
                '@media (prefers-reduced-motion: reduce)': {
                    animation: 'none',
                },
            },
        },
        {
            props: { phase: 'exit' },
            style: {
                inset: 0,
                pointerEvents: 'none',
                position: 'absolute',
                animation: `${kTitleExitKeyframes} 150ms ease-out both`,
                '@media (prefers-reduced-motion: reduce)': {
                    display: 'none',
                },
            },
        },
    ],
});

/**
 * Renders the header dock title with a fast, subtle vertical crossfade whenever the title text
 * changes, while rendering statically on initial mount.
 */
export function AnimatedTitle(props: { title: string }) {
    const [ state, setState ] = useState<{ current: string; previous?: string; version: number }>({
        current: props.title,
        version: 0,
    });

    if (props.title !== state.current) {
        setState({
            current: props.title,
            previous: state.current,
            version: state.version + 1,
        });
    }

    const handleExitEnd = useCallback(() => {
        setState(prev => prev.version === state.version ? { ...prev, previous: undefined } : prev);
    }, [ state.version ]);

    return (
        <TitleContainer component="div">
            { state.previous !== undefined &&
                <TitleText key={`exit-${state.version}`} aria-hidden="true"
                           onAnimationEnd={handleExitEnd} phase="exit">
                    {state.previous}
                </TitleText> }
            <TitleText key={`enter-${state.version}`}
                       phase={state.version > 0 ? 'enter' : 'static'}>
                {state.current}
            </TitleText>
        </TitleContainer>
    );
}
