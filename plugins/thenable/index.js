import after from './lib/thenable-after.js';
import callFunctionAfter from './lib/thenable-call-function-after.js';
import applyFunction from './lib/thenable-apply-function.js';
import callFunction from './lib/thenable-call-function.js';
import abortable from './lib/thenable-abortable.js';
import is from './lib/thenable-is.js';

var exports = {
	after: after,
	callFunctionAfter: callFunctionAfter,
	callFunction: callFunction,
	applyFunction: applyFunction,
	abortable: abortable,
	is: is
};

export default exports;