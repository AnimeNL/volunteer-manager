// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

const childProcess = require('node:child_process');
const nextBuildId = require('next-build-id');

/**
 * The staging and prod servers run on different ports, and have different Docker image names. These
 * will be shared with this script through the command line. See the commands in package.json.
 */
if (process.argv.length !== /* NodeJS: */ 2 + /* Volunteer Manager: */ 2)
    throw new Error('Usage: node Docker.build.js [port] [image]');

const port = parseInt(process.argv[2], 10);
const image = process.argv[3];

/**
 * Retrieve the build hash, which we base on the latest Git commit hash. This should stay in sync
 * with the build hash logic included in next.config.js.
 */
const buildHash = nextBuildId.sync({ dir: __dirname }).substring(0, 7);

/**
 * Execute the regular "docker build" command and inject the build hash. The argument will be picked
 * up by the Dockerfile and then be made available to next.config.js as an environment variable.
 */
childProcess.execSync(
    `docker build --cpuset-cpus 0-2 -m 2g --build-arg BUILD_HASH=${buildHash} --build-arg PORT=${port} -t ${image} .`,
    { stdio: 'inherit' });
