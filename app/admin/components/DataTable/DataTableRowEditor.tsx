// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo } from 'react';

import type { GridRowModel } from '@mui/x-data-grid-premium';
import { CheckboxElement, SelectElement, TextFieldElement, type FieldValues }
    from '@proxy/react-hook-form-mui';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';

import type { Column } from './Column';
import { ResponsiveFormDialog, type ResponsiveFormDialogProps } from '../ResponsiveFormDialog';

/**
 * Props accepted by the <DataTableRowEditor> component.
 */
interface DataTableRowEditorProps extends Pick<ResponsiveFormDialogProps, 'open' | 'onClose'> {
    /**
     * The columns configuration for the data table.
     */
    columns: Column<any>[];

    /**
     * Whether the editor is creating a new row instead of editing an existing one.
     */
    create?: boolean;

    /**
     * Callback when the changes have been saved.
     */
    onSave: (updatedRow: GridRowModel) => Promise<void>;

    /**
     * The row model currently being edited.
     */
    row?: GridRowModel;

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
    const { open, onClose, onSave, row, create } = props;

    const subject = props.subject ?? 'item';

    const visibleColumns = useMemo(() =>
        props.columns.filter(col => !col.field.startsWith('__'))
                     .filter(col => !!col.editable), [ props.columns ]);

    // ----------------------------------------------------------------------------------------------

    const handleSave = useCallback(async (data: FieldValues) => {
        const coercedValues = { ...row, ...data };
        for (const column of visibleColumns) {
            if (column.type === 'number') {
                const val = coercedValues[column.field];
                if (val !== undefined && val !== null && val !== '') {
                    coercedValues[column.field] = Number(val);
                } else {
                    coercedValues[column.field] = undefined;
                }
            }
        }

        await onSave(coercedValues);

    }, [ onSave, row, visibleColumns ]);

    // ----------------------------------------------------------------------------------------------

    return (
        <ResponsiveFormDialog
            open={open} onClose={onClose} onSubmit={handleSave}
            defaultValues={ row ?? { /* none */ } }
            title={ create ? `Create ${subject}` : `Edit ${subject}` }
            submitColor="primary" submitLabel={ create ? 'Create' : 'Save' }>

            <Box sx={{ overflowY: 'auto', maxHeight: '55vh' }}>
                { visibleColumns.length > 1 && <Divider /> }
                <Stack spacing={1.5} sx={{ my: 1 }}>
                    { visibleColumns.map(column => {
                        const label = column.description || column.headerName || column.field;

                        const placeholder = column.editorProps?.placeholder;
                        const required = !!column.editorProps?.required;

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
                                               label={label} options={options} fullWidth
                                               size="small" required={required} />
                            );
                        }

                        if (column.type === 'boolean') {
                            return (
                                <CheckboxElement key={column.field} name={column.field}
                                                 label={label} size="small" required={required}
                                                 sx={{ my: 0 }} />
                            );
                        }

                        if (column.type === 'number') {
                            return (
                                <TextFieldElement key={column.field} name={column.field}
                                                  label={label} type="number" fullWidth
                                                  size="small" required={required}
                                                  placeholder={placeholder} />
                            );
                        }

                        return (
                            <TextFieldElement key={column.field} name={column.field}
                                              label={label} type="text" fullWidth size="small"
                                              required={required} placeholder={placeholder} />
                        );
                    })}
                </Stack>
                { visibleColumns.length > 1 && <Divider /> }
            </Box>

        </ResponsiveFormDialog>
    );
}
