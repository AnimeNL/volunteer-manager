// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import dynamic from 'next/dynamic';

import type { AuthenticationFlowProps } from './AuthenticationFlow';

/**
 * Lazily load the <AuthenticationFlow> component, skip server-side rendering.
 */
const AuthenticationFlow = dynamic(() => import('./AuthenticationFlow'), { ssr: false });

/**
 * Wrapper around the <AuthenticationFlow> component that will lazily load the component. Because
 * it's rather form heavy with a complicated state machine, it adds material impact on the initial
 * page load. Lazily loading the component addresses that.
 */
export function LazyAuthenticationFlow(props: AuthenticationFlowProps) {
    return <AuthenticationFlow {...props} />;
}
