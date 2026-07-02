// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import React, { useCallback, useContext, useState } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid, { gridClasses } from '@mui/material/Grid';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { AdminClientContext } from '../AdminClientContext';
import { InlineAccountLink } from './InlineAccountLink';
import { LocalDateTime } from './LocalDateTime';

/**
 * Props accepted by the <KeyValueList> component.
 */
interface KeyValueListProps {
    /**
     * Items to display in the list. Ordered.
     */
    items: ({
        /**
         * Condition that needs to pass in order for this item to be included in the list.
         */
        condition?: boolean;

        /**
         * Description to display to explain what the item entails. Hidden by default.
         */
        description?: string;

        /**
         * Key, i.e. the label, to display explaining what the value is.
         */
        key: string;

        /**
         * Where to align the key, i.e. the label.
         * @default "top"
         */
        keyAlign?: 'center' | 'top';

    } & ({
        /**
         * Value to display. May be a React component.
         */
        value: React.ReactNode;

        /**
         * Template to use when rendering the value, for out-of-the-box customisation. A number of
         * premade template are available:
         *
         * * "account"          Displays the |value| as a link to their account, when able.
         * * "component"        Displays the |value| as a component, without wrapping.
         * * "localDateTime"    Displays the |value| as a date & time in the local timezone.
         * * "monospace"        Displays the |value| as tabular, multiline and wrappable data.
         *
         * @default "none"
         */
        valueTemplate?: 'component' | 'localDateTime' | 'monospace' | 'none';

    } | {
        /**
         * Value to display. May be a React component.
         */
        value: {
            id: number;
            name: string;
        };

        /**
         * Template to use when rendering the value, for out-of-the-box customisation. A number of
         * premade template are available:
         *
         * * "account"          Displays the |value| as a link to their account, when able.
         * * "component"        Displays the |value| as a component, without wrapping.
         * * "localDateTime"    Displays the |value| as a date & time in the local timezone.
         * * "monospace"        Displays the |value| as tabular, multiline and wrappable data.
         *
         * @default "none"
         */
        valueTemplate: 'account';

    }))[];
}

/**
 * The <KeyValueList> component displays a list of labels together with values, which can be
 * components, in a consistent and responsive manner.
 */
export function KeyValueList(props: KeyValueListProps) {
    const { isMobile } = useContext(AdminClientContext);
    const [ activeItem, setActiveItem ] = useState<{ key: string; description: string } | null>(null);

    const handleCloseDialog = useCallback(() => setActiveItem(null), []);

    return (
        <>
            <KeyValueListGrid columns={24} container>
                { props.items.filter(item => item.condition !== false).map((item, index) =>
                    <React.Fragment key={index}>
                        <Grid size={{ xs: 24, md: 7 }} sx={
                            item.keyAlign === 'center'
                                ? { display: 'flex', alignItems: 'center' }
                                : undefined
                        }>
                            <Typography variant="subtitle2" color="textSecondary" noWrap>
                                {item.key}
                                { !!item.description && (
                                    isMobile ? (
                                        <KeyValueInfoIcon
                                            fontSize="inherit"
                                            color="info"
                                            onClick={ () => setActiveItem({
                                                key: item.key,
                                                description: item.description!
                                            }) }
                                            sx={{ cursor: 'pointer' }}
                                        />
                                    ) : (
                                        <Tooltip arrow title={item.description}>
                                            <KeyValueInfoIcon fontSize="inherit" color="info" />
                                        </Tooltip>
                                    )
                                ) }
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 24, md: 17 }}>
                            { (!item.valueTemplate || item.valueTemplate === 'none') &&
                                <Typography variant="body2">
                                    {item.value}
                                </Typography> }
                            { item.valueTemplate === 'account' &&
                                <Typography variant="body2">
                                    <InlineAccountLink user={item.value} />
                                </Typography> }
                            { item.valueTemplate === 'component' && item.value }
                            { item.valueTemplate === 'localDateTime' &&
                                <Typography variant="body2">
                                    <LocalDateTime dateTime={item.value as string}
                                                   fixedWidth format="YYYY-MM-DD HH:mm:ss" />
                                </Typography> }
                            { item.valueTemplate === 'monospace' &&
                                <MonospaceTypography variant="body2">
                                    {item.value}
                                </MonospaceTypography> }
                        </Grid>
                    </React.Fragment> )}
            </KeyValueListGrid>
            { !!activeItem && (
                <Dialog open={true} onClose={handleCloseDialog} fullWidth>
                    <DialogTitle>{activeItem.key}</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2">{activeItem.description}</Typography>
                    </DialogContent>
                    <DialogActions sx={{ pt: 0, mt: -1, mr: 1, ml: 1.5, mb: 0 }}>
                        <Button onClick={handleCloseDialog}>Close</Button>
                    </DialogActions>
                </Dialog>
            )}
        </>
    );
}

/**
 * Styled variant of the information icon to align perfectly with the parent text.
 */
const KeyValueInfoIcon = styled(InfoOutlinedIcon)(({ theme }) => ({
    position: 'relative',
    marginLeft: '3px',
    top: '2px',
    cursor: 'help',
}));

/**
 * Styled variant of the <Grid> component with appropriate row padding and dividers.
 */
const KeyValueListGrid = styled(Grid)(({ theme }) => ({
    // Mobile styles:
    [theme.breakpoints.down('md')]: {
        [`& > .${gridClasses.root}:nth-child(2n)`]: {
            borderBottom: `1px solid ${theme.vars?.palette.divider}`,
            padding: theme.spacing(0.5, 0, 1, 0),
            margin: theme.spacing(0, 0, 0.5, 0),
        },
        [`& > .${gridClasses.root}:last-child`]: {
            borderBottom: 'none',
            paddingBottom: 0,
            marginBottom: 0,
        },
    },

    // Desktop styles:
    [theme.breakpoints.up('md')]: {
        [`& > .${gridClasses.root}`]: {
            borderBottom: `1px solid ${theme.vars?.palette.divider}`,
            padding: theme.spacing(0.5, 0),
        },

        [`& > .${gridClasses.root}:nth-child(2n)`]: { paddingTop: '5px' },

        [`&> .${gridClasses.root}:nth-child(-n+2)`]: {
            paddingTop: 0,
        },

        [`& > .${gridClasses.root}:nth-last-child(-n+2)`]: {
            borderBottom: 'none',
            paddingBottom: 0,
        },
    },
}));

/**
 * Styled variant of the <Typography> for text that should be displayed in a monospace font.
 */
const MonospaceTypography = styled(Typography)({
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere'
});
