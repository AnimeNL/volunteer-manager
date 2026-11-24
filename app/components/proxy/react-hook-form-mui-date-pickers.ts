// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

// Re-export the date-pickers entrypoint in its own 'use client' file so routes using only basic
// form controls from `@proxy/react-hook-form-mui` do not pull in `@mui/x-date-pickers`.
export * from 'react-hook-form-mui/date-pickers';
