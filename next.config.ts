// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextConfig } from 'next';
import NextBundleAnalyzer from '@next/bundle-analyzer';
import nextBuildId from 'next-build-id';

const nextConfig: NextConfig = {
    env: {
        // `process.env.GIT_COMMIT` will be set for Docker builds, where it's determined through the
        // next-build-id library locally on the machine for other kinds of builds. Do update
        // Docker.build.js when changing the logic in this file.
        buildHash: process.env.BUILD_HASH || nextBuildId.sync({ dir: __dirname }).substring(0, 7),
    },
    experimental: {
        // https://nextjs.org/blog/next-15-1#forbidden-and-unauthorized-experimental
        authInterrupts: true,
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
