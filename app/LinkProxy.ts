// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

// The Next.js 16 Beta changed something that stops the following set-up from working in a React
// server component, which used to be fine in previous versions. Forcing the Link element to be
// set as a clint component works around this.
//
//   import Button from '@mui/material/Button';
//   import Link from 'next/link';
//
//   <Button LinkComponent={Link}>Label</Button>
//
// Error: Functions cannot be passed directly to Client Components unless you explicitly expose it
// by marking it with "use server". Or maybe you meant to call this function rather than return it.
//
//   <... LinkComponent={function LinkComponent} children=...>
//                      ^^^^^^^^^^^^^^^^^^^^^^^^
//
// This workaround should be short lived.

'use client';

import Link from 'next/link';

export default Link;
export * from 'next/link';
