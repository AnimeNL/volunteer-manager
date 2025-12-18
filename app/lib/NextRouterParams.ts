// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Props accepted by pages using the NextJS router component, without having path-based parameters.
 */
export interface NextSearchParams {
    /**
     * Search parameters given in the URL.
     */
    searchParams: Promise<Record<string, string>>;
}

/**
 * Props accepted by layouts using the NextJS router component.
 */
interface NextLayoutParams<SingleComponentParams extends string,
                           MultiComponentParams extends string = never>
{
    /**
     * Parameters passed to the component by the NextJS router.
     */
    params: Promise<{
        /**
         * Parameter that was included in the URL.
         */
        [P in SingleComponentParams]: string;
    } & {
        /**
         * Parameters that were included in the URL.
         */
        [P in MultiComponentParams]?: string[];
    }>;
}

/**
 * Props accepted by pages using the NextJS router component.
 */
export interface NextPageParams<SingleComponentParams extends string,
                                MultiComponentParams extends string = never>
    extends NextLayoutParams<SingleComponentParams, MultiComponentParams>, NextSearchParams {}

/**
 * Props accepted by routes using the Next.js router component.
 */
export interface NextRouteParams<SingleComponentParams extends string,
                                 MultiComponentParams extends string = never>
    extends NextLayoutParams<SingleComponentParams, MultiComponentParams> {}
