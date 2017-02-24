var Target = (function() {
    function Target(executor) {
        var target = this;
        function pass(value) {
            target.reached = true;
            target.value = value;
        }
        function fail(value) {
            target.reached = false;
            target.value = value;
        }
        executor(
            pass,
            fail
        );
        return target;
    }
    Target.prototype = {
        constructor: Target,
        reached: false,
        accessor: null,
        chain: function(accessor) {
            var next;
            var accessorReturnValue = accessor(this);
            if (isTarget(accessorReturnValue)) {
                next = accessorReturnValue;
            } else {
                next = createPassedTarget(accessorReturnValue);
            }
            next.accessor = accessor;
            next.previous = this;
            return next;
        }
    };

    function createPassedTarget(value) {
        var target = new Target(function(pass) {
            pass(value);
        });
        return target;
    }
    function createFailedTarget(value) {
        var target = new Target(function(pass, fail) {
            fail(value);
        });
        return target;
    }
    function isTarget(a) {
        return a instanceof Target;
    }

    return {
        pass: createPassedTarget,
        fail: createFailedTarget,
        is: isTarget
    };
})();
var globalTarget = Target.pass(global);
var defaultTarget = Target.fail();
function createPropertyAccessor(property) {
    return function(previous) {
        if (previous.reached) {
            var value = previous.value;
            if (property in value) {
                return value[property];
            }
        }
        return Target.fail(property);
    };
}
function at() {
    var i = 0;
    var j = arguments.length;
    var accessors = [];

    if (j > 0) {
        var firstArg = arguments[0];
        if (typeof firstArg === 'string') {
            accessors.push(function() {
                return globalTarget;
            });
        }

        while (i < j) {
            var arg = arguments[i];
            if (typeof arg === 'function') {
                accessors.push(arg);
            } else if (typeof arg === 'string') {
                accessors.push(createPropertyAccessor(arg));
            }
            i++;
        }
    }

    return function() {
        var i = 0;
        var j = accessors.length;
        var finalTarget = defaultTarget;

        while (i < j) {
            var accessor = accessors[i];
            finalTarget = finalTarget.chain(accessor);
            i++;
        }

        return finalTarget;
    };
}
export {at};

function present(thenable, pass, fail, transform) {
    return thenable.then(function(output) {
        if (output.reached === false) {
            return fail('missing');
        }
        transform(output.value); // allow transformation, next expectation will use this value
        return pass('present');
    });
}
export {present};

var object = createTypeExpectation('object');
var string = createTypeExpectation('string');
var number = createTypeExpectation('number');
export {object, string, number};
function createTypeExpectation(expectedType) {
    return function(thenable, pass, fail) {
        return thenable.then(function(value) {
            var type = typeof value;
            if (type === expectedType) {
                return pass('found-' + type);
            }
            return fail('unexpected-type', type);
        });
    };
}

export function transpile() {

}

function pipeAsync(thenable, iterable) {
    var i = 0;
    var j = iterable.length;
    var composedResult = {};
    var currentThenable = thenable;

    function pass(reason, detail) {
        composedResult.status = 'passed';
        composedResult.reason = reason;
        composedResult.detail = detail;
        return composedResult;
    }
    function fail(reason, detail) {
        composedResult.status = 'failed';
        composedResult.reason = reason;
        composedResult.detail = detail;
        return composedResult;
    }
    function transform(value) {
        currentThenable = Promise.resolve(value);
    }
    function next() {
        if (i === j) {
            return composedResult;
        }
        if (composedResult.status === 'failed') {
            return composedResult;
        }
        var fn = iterable[i];
        i++;
        return fn(currentThenable, pass, fail, transform).then(next);
    }
    return new Promise(function(resolve) {
        resolve(next());
    });
}

export function expect() {
    var expectations = arguments;

    return function(thenable) {
        return pipeAsync(thenable, expectations);
    };
}

