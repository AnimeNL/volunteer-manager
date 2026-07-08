// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextConfig } from 'next';
import NextBundleAnalyzer from '@next/bundle-analyzer';

import nextPackage from 'next/package.json' with { type: 'json' };
import muiMaterialPackage from '@mui/material/package.json' with { type: 'json' };
import muiDataGridPremiumPackage from '@mui/x-data-grid-premium/package.json' with { type: 'json' };
import reactPackage from 'react/package.json' with { type: 'json' };
import volunteerManagerPackage from './package.json' with { type: 'json' };

const nextConfig: NextConfig = {
    allowedDevOrigins: [ '192.168.19.96', 'localhost' ],
    devIndicators: {
        position: 'bottom-right',
    },
    env: {
        // Information about the project, sourced from the package.json file:
        NEXT_PUBLIC_PROJECT_BUILD_DATE: new Date().toISOString(),
        NEXT_PUBLIC_PROJECT_BUILD_HASH: process.env.SOURCE_COMMIT?.substring(0, 7) || 'dev',
        NEXT_PUBLIC_PROJECT_DESCRIPTION: volunteerManagerPackage.description,
        NEXT_PUBLIC_PROJECT_HOMEPAGE: volunteerManagerPackage.homepage,
        NEXT_PUBLIC_PROJECT_VERSION: volunteerManagerPackage.version,

        // Information about the project's dependencies, sourced from their package.json files:
        NEXT_PUBLIC_VERSION_MUI: muiMaterialPackage.version,
        NEXT_PUBLIC_VERSION_MUI_X: muiDataGridPremiumPackage.version,
        NEXT_PUBLIC_VERSION_NEXTJS: nextPackage.version,
        NEXT_PUBLIC_VERSION_REACT: reactPackage.version,
    },
    experimental: {
        // https://nextjs.org/blog/next-15-1#forbidden-and-unauthorized-experimental
        authInterrupts: true,

        serverActions: {
            bodySizeLimit: '5mb',
        },

        // https://nextjs.org/docs/app/guides/view-transitions
        viewTransition: true,
    },
    output: 'standalone',
    reactStrictMode: true,
    redirects: async() => ([
        {
            source: '/hallo',
            destination: '/registration',
            permanent: true,
        },
        {
            source: '/hello',
            destination: '/registration',
            permanent: true,
        },
    ]),
    typedRoutes: false,
    typescript: {
        tsconfigPath: './tsconfig.build.json',
    },
};

module.exports = process.env.ANALYZE === 'true'
    ? NextBundleAnalyzer({ enabled: true })(nextConfig)
    : nextConfig;
