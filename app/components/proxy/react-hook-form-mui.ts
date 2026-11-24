// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

// Re-export the library in a 'use client' file to explicitly mark it as client code. This helps the
// library to be usable directly in a React Server Component.
//
// @see https://github.com/dohomi/react-hook-form-mui/issues/279
export * from 'react-hook-form-mui';
