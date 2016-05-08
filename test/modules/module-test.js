import a from './module-a.js';

a();

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        console.log('here', assert, this.href);
    }
};
