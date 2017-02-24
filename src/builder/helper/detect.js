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

const SourceCode = (function() {
    function SourceCode(source) {
        // https://github.com/dmnd/dedent/blob/master/dedent.js
        var lines = source.split('\n');
        var lowestIndent = null;
        var i = 0;
        var j = lines.length;
        while (i < j) {
            var line = lines[i];
            var match = line.match(/^(\s+)\S+/);
            if (match) {
                var indent = match[1].length;
                if (lowestIndent) {
                    lowestIndent = Math.min(lowestIndent, indent);
                } else {
                    lowestIndent = indent;
                }
            }
            i++;
        }
        if (typeof lowestIndent === 'number') {
            source = lines.map(function(line) {
                var firstChar = line[0];
                if (firstChar === ' ' || firstChar === '\t') {
                    return line.slice(lowestIndent);
                }
                return line;
            }).join('\n');
        }

        // eats leading and trailing whitespace too (trim)
        source = source.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
        // handle escaped newlines at the end to ensure they don't get stripped too
        source = source.replace(/\\n/g, "\n");

        this.source = source;
    }
    SourceCode.prototype = {
        constructor: SourceCode,
        compile: function() {
            return eval(this.source); // eslint-disable-line no-eval
        }
    };

    function createSourceCode() {
        return jsenv.construct(SourceCode, arguments);
    }

    function isSourceCode(a) {
        return a instanceof SourceCode;
    }

    return {
        create: createSourceCode,
        is: isSourceCode
    };
})();
function transpile(strings) {
    var raw = strings.raw;
    var i = 0;
    var j = raw.length;
    var result = raw[i];
    i++;
    while (i < j) {
        result += arguments[i];
        result += raw[i];
        i++;
    }
    return SourceCode.create(result);
}
export {transpile};

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

function pipeAsync(thenable, iterable) {
    var i = 0;
    var j = iterable.length;
    var composedResult = {};
    var currentThenable = thenable;
    var called = false;

    function pass(reason, detail) {
        called = true;
        composedResult.status = 'passed';
        composedResult.reason = reason;
        composedResult.detail = detail;
        return composedResult;
    }
    function fail(reason, detail) {
        called = true;
        composedResult.status = 'failed';
        composedResult.reason = reason;
        composedResult.detail = detail;
        return composedResult;
    }
    function transform(value) {
        currentThenable = Promise.resolve(value);
    }
    function next(value) {
        if (i === j) {
            return composedResult;
        }
        // allow fn to return true/false as a shortcut to calling pass/fail
        if (i > 0 && called === false) {
            if (value === true) {
                pass('returned-true');
            } else if (value === false) {
                fail('returned-false');
            }
        }
        if (composedResult.status === 'failed') {
            return composedResult;
        }
        var fn = iterable[i];
        i++;
        called = false;
        return fn(currentThenable, pass, fail, transform).then(next);
    }
    return new Promise(function(resolve) {
        resolve(next());
    });
}
function expect() {
    var expectations = arguments;

    return function(thenable) {
        return pipeAsync(thenable, expectations);
    };
}
export {expect};

function collectKeys(value) {
    var keys = [];
    for (var key in value) {
        if (value.hasOwnProperty(key)) {
            if (isNaN(key) === false && value instanceof Array) {
                // key = Number(key);
                keys.push(key);
            } else {
                keys.push(key);
            }
        }
    }
    return keys;
}
export {collectKeys};

function sameValues(a, b) {
    if (typeof a === 'string') {
        a = convertStringToArray(a);
    } else if (typeof a === 'object' && typeof a.next === 'function') {
        a = consumeIterator(a);
    }
    if (typeof b === 'string') {
        b = convertStringToArray(b);
    } else if (typeof b === 'object' && typeof b.next === 'function') {
        b = consumeIterator(b);
    }

    if (a.length !== b.length) {
        return false;
    }
    var i = a.length;
    while (i--) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}
function convertStringToArray(string) {
    var result = [];
    var i = 0;
    var j = string.length;
    while (i < j) {
        var char = string[i];

        if (i < j - 1) {
            var charCode = string.charCodeAt(i);

            // fix astral plain strings
            if (charCode >= 55296 && charCode <= 56319) {
                i++;
                result.push(char + string[i]);
            } else {
                result.push(char);
            }
        } else {
            result.push(char);
        }
        i++;
    }
    return result;
}
function consumeIterator(iterator) {
    var values = [];
    var next = iterator.next();
    while (next.done === false) {
        values.push(next.value);
        next = iterator.next();
    }
    return values;
}
export {sameValues};

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
var object = createTypeExpectation('object');
var string = createTypeExpectation('string');
var number = createTypeExpectation('number');
export {object, string, number};

function expectThrow(fn, verifyThrowValue) {
    return function(value, pass, fail) {
        try {
            fn.apply(this, arguments);
            return fail('must-throw');
        } catch (e) {
            if (verifyThrowValue) {
                if (typeof verifyThrowValue === 'function') {
                    if (verifyThrowValue(e)) {
                        return fail('throw-mismatch', e);
                    }
                    return pass('throw-match');
                }
                if (typeof verifyThrowValue === 'object') {
                    if (verifyThrowValue === e) {
                        return pass('throw-match');
                    }
                    if (typeof e === 'object') {
                        var unmatchedKey = jsenv.Iterable.find(Object.keys(verifyThrowValue), function(key) {
                            return e[key] !== verifyThrowValue[key];
                        });
                        if (unmatchedKey) {
                            return fail('throw-mismatch', {
                                expectedValue: verifyThrowValue[unmatchedKey],
                                value: e[unmatchedKey],
                                key: unmatchedKey
                            });
                        }
                        return pass('throw-match');
                    }
                    return fail('throw-type-mismatch');
                }
                if (verifyThrowValue === e) {
                    return pass('throw-match');
                }
                return fail('throw-mismatch', e);
            }
            return pass('throw-as-expected');
        }
    };
}
export {expectThrow};

