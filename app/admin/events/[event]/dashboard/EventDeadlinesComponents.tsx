// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary, { accordionSummaryClasses } from '@mui/material/AccordionSummary';
import { styled } from '@mui/material/styles';

/**
 * Variant of <Accordion> that hides the divider.
 */
export const DeadlineAccordion = styled(Accordion)(({ theme }) => ({
    boxShadow: 'none',
    '&::before': {
        display: 'none',
    },
}));

/**
 * Variant of <AccordionDetails> that exists for naming consistency.
 */
export const DeadlineAccordionDetails = AccordionDetails;

/**
 * Variant of <AccordionSummary> that allows text to overflow gracefully, and takes less space.
 */
export const DeadlineAccordionSummary = styled(AccordionSummary)(({ theme }) => ({
    justifyContent: 'flex-start',
    minHeight: '36px',

    [`& .${accordionSummaryClasses.content}`]: {
        margin: theme.spacing(0.5, 0),
        width: 'calc(100% - 32px)',
    },
}));
