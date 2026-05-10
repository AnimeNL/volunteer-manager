// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.
//
// Implementation inspired by the following recipe on the MUI website:
// https://mui.com/x/react-data-grid/components/quick-filter/#expand-quick-filter-via-keyboard

'use client';

import { useEffect, useRef } from 'react';

import { QuickFilter, QuickFilterControl, QuickFilterClear, Toolbar }
    from '@mui/x-data-grid-premium';

import CancelIcon from '@mui/icons-material/Cancel';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import TextField from '@mui/material/TextField';
import { styled } from '@mui/material/styles';

/**
 * Styled variant of the <QuickFilter> component that will occupy the entire available width.
 */
const StyledQuickFilter = styled(QuickFilter)({
    flexGrow: 1,
});

/**
 * Prominent toolbar used for our <DataTable> implementation. There are two key differences compared
 * to the default toolbar:
 *
 *   (1) The search bar is always expanded, and,
 *   (2) The search bar responds to <ctrl>+<f> keyboard shortcuts.
 *
 * Context is derived from the MUI X DataGrid context API, no props are necessary.
 */
export function DataTableProminentToolbar() {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKeyDownEvent = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
                if (inputRef.current)
                    inputRef.current.focus();

                event.preventDefault();
            }
        };

        document.addEventListener('keydown', handleKeyDownEvent);
        return () => document.removeEventListener('keydown', handleKeyDownEvent);

    }, [ /* no dependencies */ ]);

    return (
        <Toolbar>
            <StyledQuickFilter defaultExpanded expanded>
                <QuickFilterControl render={({ ref, ...controlProps }, state) => (
                    <TextField {...controlProps}
                               inputRef={ (node) => {
                                   if (ref && 'current' in ref)
                                        ref.current = node;  // is there a cleaner way?

                                   inputRef.current = node;
                               } }
                               aria-label="Search"
                               placeholder="Search..."
                               size="small" fullWidth
                               slotProps={{
                                  input: {
                                      startAdornment: (
                                          <InputAdornment position="start">
                                              <SearchIcon fontSize="small" />
                                          </InputAdornment>
                                      ),
                                      endAdornment:
                                          state.value ? (
                                              <InputAdornment position="end">
                                                  <QuickFilterClear edge="end"
                                                                    size="small"
                                                                    aria-label="Clear search"
                                                                    material={{ sx: { mr: -.75 } }}>
                                                      <CancelIcon fontSize="small" />
                                                  </QuickFilterClear>
                                              </InputAdornment> ) : null,
                                      ...controlProps.slotProps?.input,
                                  },
                                  ...controlProps.slotProps,
                               }} />
                ) } />
            </StyledQuickFilter>
        </Toolbar>
    );
}
