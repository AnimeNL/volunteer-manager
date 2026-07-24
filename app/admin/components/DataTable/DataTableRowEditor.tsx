// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { GridRowModel } from '@mui/x-data-grid-premium';
import { CheckboxElement, FormContainer, SelectElement, TextFieldElement, useForm, type FieldValues }
    from '@proxy/react-hook-form-mui';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

import type { Column } from './Column';
import { ButtonContainer, DrawerTitle, StyledDrawer } from './DeleteConfirmation';

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

    const form = useForm({ defaultValues: row ?? {} });
    const { reset } = form;

    useEffect(() => {
        if (open && row)
            reset({ ...row });

    }, [open, row, reset]);

    const visibleColumns = useMemo(() =>
        props.columns.filter(col => !col.field.startsWith('__')), [ props.columns ]);

    // ----------------------------------------------------------------------------------------------

    const handleSave = useCallback(async (data: FieldValues) => {
        setLoading(true);

        const coercedValues = { ...data };
        for (const column of visibleColumns) {
            if (column.type === 'number') {
                const val = coercedValues[column.field];
                if (val !== undefined && val !== null && val !== '') {
                    coercedValues[column.field] = Number(val);
                } else {
                    coercedValues[column.field] = '';
                }
            }
        }

        await onSave(coercedValues);
        setLoading(false);

    }, [onSave, visibleColumns]);

    // ----------------------------------------------------------------------------------------------

    return (
        <StyledDrawer anchor="bottom" open={open} onClose={onClose}>
            <DrawerTitle variant="h6">
                Edit {subject}
            </DrawerTitle>
            <FormContainer formContext={form} onSuccess={handleSave}>
                <Box sx={{ overflowY: 'auto', maxHeight: '55vh', my: 1, px: 0.5 }}>
                    <Stack spacing={2.5} sx={{ py: 1 }}>
                        { visibleColumns.map(column => {
                            const label = column.headerName || column.field;
                            const isEditable = !!column.editable;

                            if (column.type === 'singleSelect') {
                                const rawOptions = typeof (column as any).valueOptions === 'function'
                                    ? (column as any).valueOptions({ row: row ?? {} })
                                    : (column as any).valueOptions;

                                const options = Array.isArray(rawOptions)
                                    ? rawOptions.map(option => {
                                          if (typeof option === 'object' && option !== null) {
                                              return {
                                                id: option.value,
                                                label: String(option.label || option.value)
                                              };
                                          }

                                          return { id: option, label: String(option) };
                                      })
                                    : [];

                                return (
                                    <SelectElement key={column.field} name={column.field}
                                                   label={label} options={options}
                                                   disabled={!isEditable} fullWidth size="small" />
                                );
                            }

                            if (column.type === 'boolean') {
                                return (
                                    <CheckboxElement key={column.field} name={column.field}
                                                     label={label} disabled={!isEditable} />
                                );
                            }

                            if (column.type === 'number') {
                                return (
                                    <TextFieldElement key={column.field} name={column.field}
                                                      label={label} type="number"
                                                      disabled={!isEditable} fullWidth
                                                      size="small" />
                                );
                            }

                            return (
                                <TextFieldElement key={column.field} name={column.field}
                                                  label={label} type="text" disabled={!isEditable}
                                                  fullWidth size="small" />
                            );
                        })}
                    </Stack>
                </Box>
                <ButtonContainer sx={{ mt: 2 }}>
                    <Button type="submit" loading={loading} variant="contained" color="primary">
                        Save
                    </Button>
                    <Button onClick={onClose} variant="text">
                        Cancel
                    </Button>
                </ButtonContainer>
            </FormContainer>
        </StyledDrawer>
    );
}

