// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';

import { executeAction } from '../../Action';
import { getDocumentation, kGetDocumentationDefinition } from './getDocumentation';

/**
 * Read-only version of documentation topics. We require the user to be signed in, but otherwise
 * we don't do any particular access checks to access documentation.
 */
export async function GET(request: NextRequest, props: unknown) {
    return executeAction(request, kGetDocumentationDefinition, getDocumentation);
}
