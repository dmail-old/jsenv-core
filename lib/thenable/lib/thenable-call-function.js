import createThenableFromFunctionCall from './thenable-apply-function.js';

function createThenableFromFunctionPartialCall(fn, bind){
	var args = Array.prototype.slice.call(arguments, 2);

	return createThenableFromFunctionCall(fn, bind, args);
}

export default createThenableFromFunctionPartialCall;
