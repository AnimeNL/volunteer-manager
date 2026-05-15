// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { generateHashedDataSourceId } from './createDataSource';

describe('generateHashedDataSourceId', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
        process.env.buildHash = 'mock-build-hash';
        process.env.APP_SERVER_ACTION_SALT = 'mock-salt';
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should be sensitive to the given dataSourceId', () => {
        const hash1 = generateHashedDataSourceId('datasource-1');
        const hash2 = generateHashedDataSourceId('datasource-2');
        expect(hash1).not.toBe(hash2);
    });

    it('should be sensitive to the environments build hash', () => {
        const hash1 = generateHashedDataSourceId('datasource-1');
        process.env.buildHash = 'different-build-hash';
        const hash2 = generateHashedDataSourceId('datasource-1');
        expect(hash1).not.toBe(hash2);
    });

    it('should be sensitive to the environments server action salt', () => {
        const hash1 = generateHashedDataSourceId('datasource-1');
        process.env.APP_SERVER_ACTION_SALT = 'different-salt';
        const hash2 = generateHashedDataSourceId('datasource-1');
        expect(hash1).not.toBe(hash2);
    });

    it('should handle missing environment variables safely', () => {
        delete process.env.buildHash;
        delete process.env.APP_SERVER_ACTION_SALT;
        expect(() => generateHashedDataSourceId('datasource-1')).not.toThrow();

        const hash1 = generateHashedDataSourceId('datasource-1');
        const hash2 = generateHashedDataSourceId('datasource-2');
        expect(hash1).not.toBe(hash2);
    });
});
