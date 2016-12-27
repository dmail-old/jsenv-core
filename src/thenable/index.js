import after from './src/thenable-after.js';
import callFunctionAfter from './src/thenable-call-function-after.js';
import applyFunction from './src/thenable-apply-function.js';
import callFunction from './src/thenable-call-function.js';
import abortable from './src/thenable-abortable.js';
import is from './src/thenable-is.js';

const exports = {
    after,
    callFunctionAfter,
    callFunction,
    applyFunction,
    abortable,
    is
};

export default exports;
