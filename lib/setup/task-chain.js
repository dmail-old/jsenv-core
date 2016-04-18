import jsenv from 'jsenv';
import proto from 'jsenv/proto';
// import Options from 'jsenv/options';
import Timeout from 'jsenv/timeout';
import Thenable from 'jsenv/thenable';
import Iterable from 'jsenv/iterable';

/*

It's VERY similar to test object used for unit testing so Test will extend Task
cause we need same functionalities : modules, skip, agents, etc

*/

let TaskChain = proto.extend('TaskChain', {
    constructor() {
        this.tasks = [];
    },

    get(taskName) {
        return this.tasks.find(function(task) {
            return task.name === taskName;
        });
    },

    enable(taskName) {
        return this.get(taskName).unskip();
    },

    disable(taskName) {
        return this.get(taskName).skip('disable');
    },

    add(task) {
        this.tasks.push(task);
        return task;
    },

    insert(task, beforeTask) {
        if (beforeTask.ended) {
            throw new Error(beforeTask.name + 'task is ended : cannot insert task before it');
        }

        var index = this.tasks.indexOf(beforeTask);
        if (index === -1) {
            throw new Error('cannot insert' + task + ' before: not in the task chain');
        }
        this.tasks.splice(index, 0, task);
        return task;
    },

    createTask(...args) {
        return Task.create(...args);
    },

    start() {
        var iterableTaskPromise = Iterable.map(this.tasks, function(task) {
            this.task = task;
            jsenv.debug('start task', task.name);

            return task.start();
        }, this);

        return Iterable.reduceToThenable(iterableTaskPromise);
    }
});

export default TaskChain;
