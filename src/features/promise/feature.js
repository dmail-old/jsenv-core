// https://developer.mozilla.org/en-US/docs/Web/API/PromiseRejectionEvent
// https://googlechrome.github.io/samples/promise-rejection-events/
import {at, present} from 'helper/detect.js';
const constructorName = 'Promise';
const test = {
    run: at(constructorName),
    complete: present
};
export {test};

const solution = {
    type: 'corejs',
    value: 'es6.promise'
};
export {solution};
