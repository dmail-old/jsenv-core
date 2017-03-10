import createThenableFromFunctionCall from './thenable-apply-function.js';

function createThenableFromFunctionPartialCall(fn, bind, ...args) {
    return createThenableFromFunctionCall(fn, bind, args);
}

export default createThenableFromFunctionPartialCall;
