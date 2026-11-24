// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { MockScheduler } from './MockScheduler';

describe('Scheduler', () => {
    it('maintains a priority queue of the to-be-executed tasks', async () => {
        const scheduler = new MockScheduler();

        const resultArray: string[] = [];

        scheduler.registerTask('MyFirstTask', async () => { resultArray.push('first'); });
        scheduler.registerTask('MySecondTask', async () => { resultArray.push('second'); });

        scheduler.queueTask({ taskName: 'MyFirstTask' }, /* delayMs= */ 5);  // order: 1
        scheduler.queueTask({ taskName: 'MyFirstTask' }, /* delayMs= */ 25);  // order: 5
        scheduler.queueTask({ taskName: 'MyFirstTask' }, /* delayMs= */ 10);  // order: 2

        scheduler.queueTask({ taskName: 'MySecondTask' }, /* delayMs= */ 20);  // order: 4
        scheduler.queueTask({ taskName: 'MySecondTask' }, /* delayMs= */ 15);  // order: 3
        scheduler.queueTask({ taskName: 'MySecondTask' }, /* delayMs= */ 30);  // order: 6

        expect(scheduler.taskQueueSize).toBe(6);

        while (resultArray.length < 6) {
            await new Promise(resolve => setTimeout(resolve, /* ms= */ 5));
            await scheduler.execute();
        }

        expect(scheduler.taskQueueSize).toBe(0);

        expect(resultArray).toStrictEqual(
            [ 'first', 'first', 'second', 'second', 'first', 'second' ]);
    });

    it('has the ability to clear all scheduled tasks', async () => {
        const scheduler = new MockScheduler();

        let resultCounter = 0;

        scheduler.registerTask('MyTask', async () => { resultCounter++; });

        scheduler.queueTask({ taskName: 'MyTask' }, /* delayMs= */ 5);
        scheduler.queueTask({ taskName: 'MyTask' }, /* delayMs= */ 10);
        scheduler.queueTask({ taskName: 'MyTask' }, /* delayMs= */ 15);
        scheduler.queueTask({ taskName: 'MyTask' }, /* delayMs= */ 20);

        expect(scheduler.taskQueueSize).toBe(4);

        while (resultCounter < 2) {
            await new Promise(resolve => setTimeout(resolve, /* ms= */ 5));
            await scheduler.execute();
        }

        expect(scheduler.taskQueueSize).toBe(2);

        scheduler.clearTasks();

        expect(scheduler.taskQueueSize).toBe(0);

        for (let iteration = 0; iteration < 4; ++iteration) {
            await new Promise(resolve => setTimeout(resolve, /* ms= */ 5));
            await scheduler.execute();
        }

        expect(resultCounter).toBe(2);  // unchanged
    });
});
