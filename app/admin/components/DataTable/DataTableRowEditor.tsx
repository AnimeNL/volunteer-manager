// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { GridRowModel } from '@mui/x-data-grid-premium';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Drawer, { drawerClasses } from '@mui/material/Drawer';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import type { Column } from './Column';

/**
 * Props accepted by the <DataTableRowEditor> component.
 */
interface DataTableRowEditorProps {
    /**
     * Whether the editor drawer should be open.
     */
    open: boolean;

    /**
     * Callback when the editor has been closed.
     */
    onClose: () => void;

    /**
     * Callback when the changes have been saved.
     */
    onSave: (updatedRow: GridRowModel) => Promise<void>;

    /**
     * The row model currently being edited.
     */
    row?: GridRowModel;

    /**
     * The columns configuration for the data table.
     */
    columns: Column<any>[];

    /**
     * Subject describing what is being edited.
     * @default "item"
     */
    subject?: string;
}

/**
 * Component for the mobile row editing bottom sheet, to make much of the editable information much
 * more accessible.
 */
export function DataTableRowEditor(props: DataTableRowEditorProps) {
    const { open, onClose, onSave, row } = props;

    const subject = props.subject ?? 'item';

    const [ loading, setLoading ] = useState<boolean>(false);
    const [ values, setValues ] = useState<Record<string, any>>({});

    useEffect(() => {
        if (open && row)
            setValues({ ...row });

    }, [open, row]);

    const visibleColumns = useMemo(() =>
        props.columns.filter(col => !col.field.startsWith('__')), [ props.columns ]);

    // ----------------------------------------------------------------------------------------------

    const handleChange = useCallback((field: string, value: any) => {
        setValues(prev => ({ ...prev, [field]: value }));
    }, [ /* no deps */ ]);

    const handleSave = useCallback(async () => {
        setLoading(true);
        await onSave(values);
        setLoading(false);

    }, [onSave, values]);

    // ----------------------------------------------------------------------------------------------

    return (
        <StyledDrawer anchor="bottom" open={open} onClose={onClose}>
            <DrawerTitle variant="h6">
                Edit {subject}
            </DrawerTitle>
            <Box sx={{ overflowY: 'auto', maxHeight: '55vh', my: 1, px: 0.5 }}>
                <Stack spacing={2.5} sx={{ py: 1 }}>
                    { visibleColumns.map(column => {
                        const label = column.headerName || column.field;
                        const isEditable = !!column.editable;
                        const value = values[column.field];

                        if (column.type === 'singleSelect') {
                            const rawOptions = typeof (column as any).valueOptions === 'function'
                                ? (column as any).valueOptions({ row: row ?? {} })
                                : (column as any).valueOptions;

                            const options = Array.isArray(rawOptions)
                                ? rawOptions.map(option => {
                                      if (typeof option === 'object' && option !== null) {
                                          return { value: option.value, label: String(option.label || option.value) };
                                      }
                                      return { value: option, label: String(option) };
                                  })
                                : [];

                            return (
                                <FormControl key={column.field} fullWidth disabled={!isEditable} size="small">
                                    <InputLabel id={`row-editor-select-label-${column.field}`}>{label}</InputLabel>
                                    <Select
                                        labelId={`row-editor-select-label-${column.field}`}
                                        label={label}
                                        value={value ?? ''}
                                        onChange={e => handleChange(column.field, e.target.value)}
                                    >
                                        {options.map(opt => (
                                            <MenuItem key={String(opt.value)} value={opt.value}>
                                                {opt.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            );
                        }

                        if (column.type === 'boolean') {
                            return (
                                <FormControlLabel
                                    key={column.field}
                                    control={
                                        <Checkbox
                                            checked={!!value}
                                            disabled={!isEditable}
                                            onChange={e => handleChange(column.field, e.target.checked)}
                                        />
                                    }
                                    label={label}
                                />
                            );
                        }

                        if (column.type === 'number') {
                            return (
                                <TextField
                                    key={column.field}
                                    label={label}
                                    type="number"
                                    fullWidth
                                    size="small"
                                    disabled={!isEditable}
                                    value={value ?? ''}
                                    onChange={e => handleChange(column.field, e.target.value === '' ? '' : Number(e.target.value))}
                                />
                            );
                        }

                        return (
                            <TextField
                                key={column.field}
                                label={label}
                                type="text"
                                fullWidth
                                size="small"
                                disabled={!isEditable}
                                value={value ?? ''}
                                onChange={e => handleChange(column.field, e.target.value)}
                            />
                        );
                    })}
                </Stack>
            </Box>
            <ButtonContainer>
                <Button onClick={handleSave} loading={loading} variant="contained" color="primary">
                    Save
                </Button>
                <Button onClick={onClose} variant="text">
                    Cancel
                </Button>
            </ButtonContainer>
        </StyledDrawer>
    );
}

/**
 * Styled drawer. Adjusted styling to behave like a Material UI bottom sheet.
 */
const StyledDrawer = styled(Drawer)(({ theme }) => ({
    [`& .${drawerClasses.paper}`]: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingLeft: theme.spacing(2),
        paddingRight: theme.spacing(2),
        paddingBottom: theme.spacing(4),
        paddingTop: theme.spacing(1),
        maxHeight: '90vh',
    },
}));

/**
 * Styled title, with amended spacing around it.
 */
const DrawerTitle = styled(Typography)(({ theme }) => ({
    margin: theme.spacing(1, 0),
    fontWeight: 'bold',
}));

/**
 * Container for the buttons available to the user, where they select what should happen.
 */
const ButtonContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(2),
}));
