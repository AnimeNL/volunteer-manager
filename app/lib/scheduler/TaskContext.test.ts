// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { TaskContext, kTaskLogSeverity } from './TaskContext';

describe('TaskContext', () => {
    it('reflects basic information about the task it is responsible for', () => {
        const context = TaskContext.forEphemeralTask('MyTask', { foo: 'bar' });

        expect(context.taskName).toEqual('MyTask');
        expect(context.params).toEqual({ foo: 'bar' });
    });

    it('can store log entries at different levels of severity', () => {
        const context = TaskContext.forEphemeralTask('MyTask', { /* no params */ });

        context.log.debug('Some detail happened', 1, 2, 3);

        context.log.startTime = process.hrtime.bigint();

        context.log.info('Something did happen', 'a', 'b', 'c');
        context.log.warning('Something almost went wrong', true, false, false);
        context.log.error('Something went wrong');
        context.log.exception('Something went very wrong', new Error('Oh no!'));

        expect(context.log.entries).toHaveLength(5);

        expect(context.log.entries[0].severity).toEqual(kTaskLogSeverity.Debug);
        expect(context.log.entries[0].time).toBeUndefined();
        expect(context.log.entries[0].message).toEqual('Some detail happened');
        expect(context.log.entries[0].data).toEqual([ 1, 2, 3 ]);

        expect(context.log.entries[1].severity).toEqual(kTaskLogSeverity.Info);
        expect(context.log.entries[1].time).toBeGreaterThan(0);
        expect(context.log.entries[1].message).toEqual('Something did happen');
        expect(context.log.entries[1].data).toEqual([ 'a', 'b', 'c' ]);

        expect(context.log.entries[2].severity).toEqual(kTaskLogSeverity.Warning);
        expect(context.log.entries[2].time).toBeGreaterThan(context.log.entries[1].time!);
        expect(context.log.entries[2].message).toEqual('Something almost went wrong');
        expect(context.log.entries[2].data).toEqual([ true, false, false ]);

        expect(context.log.entries[3].severity).toEqual(kTaskLogSeverity.Error);
        expect(context.log.entries[3].time).toBeGreaterThan(context.log.entries[2].time!);
        expect(context.log.entries[3].message).toEqual('Something went wrong');
        expect(context.log.entries[3].data).toHaveLength(0);

        expect(context.log.entries[4].severity).toEqual(kTaskLogSeverity.Exception);
        expect(context.log.entries[4].time).toBeGreaterThan(context.log.entries[3].time!);
        expect(context.log.entries[4].message).toEqual('Something went very wrong');
        expect(context.log.entries[4].data).toHaveLength(1);
        expect(context.log.entries[4].data[0].message).toEqual('Oh no!');
    });

    it('can keep track of task execution time', async () => {
        const context = TaskContext.forEphemeralTask('MyTask', { /* no params */ });

        expect(() => context.markTaskExecutionFinished()).toThrow(/has not started yet/);
        expect(context.runtimeMs).toBeUndefined();

        context.markTaskExecutionStart();
        expect(() => context.markTaskExecutionStart()).toThrow(/has already started/);
        expect(context.runtimeMs).toBeUndefined();

        await new Promise(resolve => setTimeout(resolve, 1001));

        context.markTaskExecutionFinished();
        expect(() => context.markTaskExecutionFinished()).toThrow(/has already finished/);

        expect(context.runtimeMs).toBeGreaterThan(1);
    });
});
