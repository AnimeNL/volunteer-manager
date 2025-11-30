// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Accordion, { accordionClasses } from '@mui/material/Accordion';
import AccordionSummary, { accordionSummaryClasses } from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Alert, { alertClasses } from '@mui/material/Alert';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FindReplaceIcon from '@mui/icons-material/FindReplace';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { Prompt } from '@lib/ai/Prompt';

/**
 * Props accepted by the <TokenOverviewAlert> component. This component either accepts a prompt, or
 * a record of token names together with their example values, but not both.
 */
type TokenOverviewAlertProps = {
    /**
     * The prompt for which available token information should be displayed.
     */
    prompt: Prompt<any>;
} | {
    /**
     * The tokens that are available for use in this prompt.
     */
    tokens: Record<string, string>;
};

/**
 * The <TokenOverviewAlert> component gives an overview of the tokens that are available for a
 * certain prompt. It's styled roughly like a regular <Alert>, but with the ability to expand it to
 * see both the tokens and example values that can be associated with those tokens.
 */
export function TokenOverviewAlert(props: TokenOverviewAlertProps) {
    let parameters: [ string, string ][];
    if ('prompt' in props) {
        parameters = [ ...props.prompt.parameters.entries() ];
    } else {
        parameters = Object.entries(props.tokens);
    }

    if (!parameters.length) {
        return (
            <Alert icon={ <FindReplaceIcon fontSize="inherit" /> } severity="info">
                No tokens are supported by this prompt.
            </Alert>
        );
    }

    const sortedParameters = parameters.sort((lhs, rhs) => lhs[0].localeCompare(rhs[0]));

    return (
        <Alert icon={ <FindReplaceIcon fontSize="inherit" /> } severity="info" sx={{
            [`& .${alertClasses.message}`]: {
                flexGrow: 1,
                padding: 0,
            },
        }}>
            <Accordion disableGutters square variant="outlined" sx={{
                [`&.${accordionClasses.root}`]: {
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    borderWidth: 0,
                    color: 'inherit',
                    overflow: 'hidden',
                },
            }}>
                <AccordionSummary expandIcon={ <ExpandMoreIcon /> } sx={{
                    [`& .${accordionSummaryClasses.content}`]: { margin: 0 },
                    [`&.${accordionSummaryClasses.root}`]: {
                        minHeight: 0,
                        paddingX: 0,
                        paddingY: 0.75,
                    },
                }}>
                    <Typography variant="body2">
                        <strong>{parameters.length} token{parameters.length > 1 ? 's' : ''}</strong>
                        {parameters.length > 1 ? ' are' : ' is'} supported by this prompt…
                    </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0, pb: 1 }}>
                    <Stack direction="column">
                        { sortedParameters.map(([ parameter, example ]) =>
                            <Stack key={parameter} direction="row" alignItems="center" spacing={1}>
                                <ChevronRightIcon fontSize="inherit" />
                                <Typography variant="body2">
                                    {'{{'}{parameter}{'}}'}
                                    <Typography component="span" variant="inherit" sx={{
                                        fontStyle: 'italic',
                                    }}>
                                        {' '}— {example}
                                    </Typography>
                                </Typography>
                            </Stack> )}
                    </Stack>
                </AccordionDetails>
            </Accordion>
        </Alert>
    );
}
