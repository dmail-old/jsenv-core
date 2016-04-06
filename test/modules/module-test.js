import a from './module-a.js';

a();

export const test = {
    modules: ['node/assert'],

    fn(assert) {
        console.log(assert);
    }
};
