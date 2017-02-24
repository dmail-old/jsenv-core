var collector = (function () {
    'use strict';

    "intro";

    var parent = {
        name: 'parent'
    };

    var dependency = {
        name: 'dependency'
    };

    var Target = function () {
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
            executor(pass, fail);
            return target;
        }
        Target.prototype = {
            constructor: Target,
            reached: false,
            accessor: null,
            chain: function (accessor) {
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
            var target = new Target(function (pass) {
                pass(value);
            });
            return target;
        }
        function createFailedTarget(value) {
            var target = new Target(function (pass, fail) {
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
    }();
    var globalTarget = Target.pass(global);
    var defaultTarget = Target.fail();
    function createPropertyAccessor(property) {
        return function (previous) {
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
                accessors.push(function () {
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

        return function () {
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
    function present(thenable, pass, fail, transform) {
        return thenable.then(function (output) {
            if (output.reached === false) {
                return fail('missing');
            }
            transform(output.value); // allow transformation, next expectation will use this value
            return pass('present');
        });
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
        return new Promise(function (resolve) {
            resolve(next());
        });
    }

    function expect() {
        var expectations = arguments;

        return function (thenable) {
            return pipeAsync(thenable, expectations);
        };
    }

    function objectIsCoercible() {}

    function defineMethod() /* object, methodName, method */{}

    var path = 'trimEnd';
    var feature = {
        dependencies: [parent, dependency],
        run: at(parent.run, dependency.run, path),
        test: expect(present),
        solution: {
            type: 'inline',
            value: fix
        }
    };

    var whiteSpaces = ['\x09', '\x0A', '\x0B', '\x0C', '\x0D', '\x20', '\xA0', '\u1680', '\u180E', '\u2000', '\u2001', '\u2002', '\u2003', '\u2004', '\u2005', '\u2006', '\u2007', '\u2008', '\u2009', '\u200A', '\u202F', '\u205F', '\u3000', '\u2028', '\u2029', '\uFEFF'];
    var regexp = new RegExp(whiteSpaces.join('') + whiteSpaces.join('') + '*$');
    function trimEnd() {
        objectIsCoercible(this);
        var string$$1 = String(this);
        return string$$1.replace(regexp, '');
    }
    function fix() {
        defineMethod(at(parent.run).value, path, trimEnd);
    }

    var collector = [];
    collector.push({ "default": feature });

    return collector;

    "outro";

}());
collector;
