// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';
import { LogBuilder } from './LogBuilder';
import { RecordAfterRequestFinished, RecordImmediately } from './LogRecorder';

vi.mock('./LogRecorder', () => ({
    RecordAfterRequestFinished: vi.fn(),
    RecordImmediately: vi.fn().mockResolvedValue(undefined),
}));

describe('LogBuilder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should record when condition is true', async () => {
        LogBuilder.for('TestWithoutParameters')
            .withCondition(true)
            .record();

        expect(RecordAfterRequestFinished).toHaveBeenCalledTimes(1);

        await LogBuilder.for('TestWithoutParameters')
            .withCondition(true)
            .recordImmediately();

        expect(RecordImmediately).toHaveBeenCalledTimes(1);
    });

    it('should not record when condition is false', async () => {
        LogBuilder.for('TestWithoutParameters')
            .withCondition(false)
            .record();

        expect(RecordAfterRequestFinished).not.toHaveBeenCalled();

        await LogBuilder.for('TestWithoutParameters')
            .withCondition(false)
            .recordImmediately();

        expect(RecordImmediately).not.toHaveBeenCalled();
    });

    it('should be able to record the log type', () => {
        const message = LogBuilder.for('TestWithoutParameters')
            .build();

        expect(message.type).toBe('TestWithoutParameters');
        expect(message.diff).toBeUndefined();
        expect(message.severity).toBe('Info');
        expect(message.initiatorUserId).toBeUndefined();
        expect(message.affectedUserId).toBeUndefined();
    });
    
    it('should be able to record the initiator and target users', () => {
        const message = LogBuilder.for('TestWithoutParameters')
            .withInitiatorUser(42)
            .withAffectedUser(50)
            .build();

        expect(message.type).toBe('TestWithoutParameters');
        expect(message.diff).toBeUndefined();
        expect(message.severity).toBe('Info');
        expect(message.initiatorUserId).toBe(42);
        expect(message.affectedUserId).toBe(50);
    });

    it('should be able to record the log severity level', () => {
        const message = LogBuilder.for('TestWithoutParameters')
            .withSeverity('Error')
            .build();

        expect(message.type).toBe('TestWithoutParameters');
        expect(message.diff).toBeUndefined();
        expect(message.severity).toBe('Error');
        expect(message.initiatorUserId).toBeUndefined();
        expect(message.affectedUserId).toBeUndefined();
    });

    it('should be able to strict type check the parameters', () => {
        const message = LogBuilder.for('TestWithParameters')
            .build({ firstName: 'Joe', age: 28 });

        expect(message.type).toBe('TestWithParameters');
        expect(message.diff).toBeUndefined();
        expect(message.severity).toBe('Info');
        expect(message.initiatorUserId).toBeUndefined();
        expect(message.affectedUserId).toBeUndefined();
        expect(message.parameters).toEqual({
            firstName: 'Joe',
            age: 28
        });
    });

    it('should be able to log differences with a recording', () => {
        const message = LogBuilder.for('TestWithoutParameters')
            .withDiff({
                IdenticalFieldName: {
                    before: 101,
                    after: 101,
                },
                UpdatedFieldName: {
                    before: 'Left',
                    after: 'Right',
                },
            })
            .build();

        expect(message.type).toBe('TestWithoutParameters');
        expect(message.diff).toEqual({
            UpdatedFieldName: {
                before: 'Left',
                after: 'Right',
            },
        });
        expect(message.severity).toBe('Info');
        expect(message.initiatorUserId).toBeUndefined();
        expect(message.affectedUserId).toBeUndefined();
    });
});
