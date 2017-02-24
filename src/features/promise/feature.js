// https://developer.mozilla.org/en-US/docs/Web/API/PromiseRejectionEvent
// https://googlechrome.github.io/samples/promise-rejection-events/
import {at, expect, present} from 'helper/detect.js';

const path = 'Promise';
const feature = {
    run: at(path),
    test: expect(present),
    solution: {
        type: 'corejs',
        value: 'es6.promise'
    }
};

export default feature;
