import '/symbol/iterator/test.js';
import '/object/create/test.js';
import '/let/test.js';

import {transpile, every, expectThrow, sameValues, createIterableObject} from '/test-helpers.js';

const test = {
    children: [
        {
            name: 'assignment',
            children: [
                {
                    name: 'array-notation',
                    run: transpile`(function(a, b) {
                        [b, a] = [a, b];
                        return [a, b];
                    })`,
                    complete(fn) {
                        var a = 1;
                        var b = 2;
                        var result = fn(a, b);
                        return sameValues(result, [b, a]);
                    },
                    children: [
                        {
                            name: 'chain',
                            run: transpile`(function(value) {
                                var a, b;
                                ([a] = [b] = [value]);
                                return [a, b];
                            })`,
                            complete(fn) {
                                var value = 1;
                                var result = fn(value);
                                return sameValues(result, [value, value]);
                            }
                        },
                        {
                            name: 'empty',
                            run: transpile`(function() {
                                [] = [1,2];
                            })`,
                            complete(fn) {
                                fn();
                                return true;
                            }
                        },
                        {
                            name: 'expression-return',
                            run: transpile`(function(value) {
                                var a;
                                return ([a] = value);
                            })`,
                            complete(fn) {
                                var value = [];
                                var result = fn(value);
                                return result === value;
                            }
                        },
                        {
                            name: 'rest-nest',
                            run: transpile`(function(first, middle, last) {
                                var value = [first, middle, last];
                                var head;
                                var tail;
                                [head, ...[value[2], tail]] = value;
                                return [value, head, tail];
                            })`,
                            complete(fn) {
                                var first = 1;
                                var middle = 2;
                                var last = 3;
                                var result = fn(first, middle, last);

                                return (
                                    sameValues(result[0], [first, middle, middle]) &&
                                    result[1] === first &&
                                    result[2] === last
                                );
                            }
                        }
                    ]
                },
                {
                    name: 'object-notation',
                    run: transpile`(function(value) {
                        ({a} = {a: value});
                        return a;
                    })`,
                    complete(fn) {
                        var value = 1;
                        var result = fn(value);
                        return result === value;
                    },
                    children: [
                        {
                            name: 'chain',
                            run: transpile`(function(value) {
                                var a, b;
                                ({a} = {b} = {a: value, b: value});
                                return [a, b];
                            })`,
                            complete(fn) {
                                var value = 1;
                                var result = fn(value);
                                return sameValues(result, [value, value]);
                            }
                        },
                        {
                            name: 'empty',
                            run: transpile`(function() {
                                ({} = {a:1, b:2});
                            })`,
                            complete(fn) {
                                fn();
                            }
                        },
                        {
                            name: 'expression-return',
                            run: transpile`(function(value) {
                                var a;
                                return ({a} = value);
                            })`,
                            complete(fn) {
                                var value = {};
                                var result = fn(value);
                                return result === value;
                            }
                        },
                        {
                            name: 'rest-nest',
                            run: transpile`(function(first, middle, last) {
                                var value = [first, middle, last];
                                var head;
                                var tail;
                                [head, ...[value[2], tail]] = value;
                                return [value, head, tail];
                            })`,
                            complete(fn) {
                                var first = 1;
                                var middle = 2;
                                var last = 3;
                                var result = fn(first, middle, last);

                                return (
                                    sameValues(result[0], [first, middle, middle]) &&
                                    result[1] === first &&
                                    result[2] === last
                                );
                            }
                        },
                        {
                            name: 'throw-left-parenthesis',
                            run: transpile`(function(value) {
                                var a;
                                ({a}) = value;
                            })`,
                            crash(error) {
                                return error instanceof SyntaxError;
                            }
                        }
                    ]
                }
            ]
        },
        {
            name: 'declaration',
            children: [
                {
                    name: 'array-notation',
                    run: transpile`(function(value) {
                        var [a] = value;
                        return a;
                    })`,
                    complete(fn) {
                        var value = 1;
                        var result = fn([value]);
                        return result === value;
                    },
                    children: [
                        {
                            name: 'default',
                            run: transpile`(function(defaultValues, values) {
                                var [a = defaultValues[0], b = defaultValues[1], c = defaultValues[2]] = values;
                                return [a, b, c];
                            })`,
                            complete(fn) {
                                var defaultA = 1;
                                var defaultB = 2;
                                var defaultC = 3;
                                var a = 4;
                                var result = fn(
                                    [
                                        defaultA,
                                        defaultB,
                                        defaultC
                                    ],
                                    [ // eslint-disable-line no-sparse-arrays
                                        a,
                                        , // eslint-disable-line comma-style
                                        undefined
                                    ]
                                );

                                return sameValues(result, [a, defaultB, defaultC]);
                            }
                        },
                        {
                            name: 'expression-return',
                            run: transpile`(function(value) {
                                var a;
                                return ([a] = value);
                            })`,
                            complete(fn) {
                                var value = [];
                                var result = fn(value);
                                return result === value;
                            }
                        },
                        {
                            name: 'iterable',
                            run: transpile`(function(value) {
                                var [a, b, c] = value;
                                return [a, b, c];
                            })`,
                            complete(fn) {
                                var data = [1, 2];
                                var iterable = createIterableObject(data);
                                var result = fn(iterable);
                                var instanceResult = fn(Object.create(iterable));

                                return (
                                    sameValues(result, [1, 2, undefined]) &&
                                    sameValues(instanceResult, [1, 2, undefined])
                                );
                            }
                        },
                        {
                            name: 'nested',
                            run: transpile`(function(value) {
                                var [[a]] = value;
                                return a;
                            })`,
                            complete(fn) {
                                var value = 1;
                                var result = fn([[value]]);
                                return result === value;
                            }
                        },
                        {
                            name: 'rest',
                            run: transpile`(function(value) {
                                var [a, ...b] = value;
                                return [a, b];
                            })`,
                            complete(fn) {
                                var firstValue = 1;
                                var lastValue = 2;
                                var firstResult = fn([firstValue, lastValue]);
                                var secondResult = fn([firstValue]);

                                return (
                                    firstResult[0] === firstValue &&
                                    sameValues(firstResult[1], [lastValue]) &&
                                    secondResult[0] === firstValue &&
                                    sameValues(secondResult[1], [])
                                );
                            }
                        },
                        {
                            name: 'sparse',
                            run: transpile`(function(value) {
                                var [a, ,b] = value;
                                return [a, b];
                            })`,
                            complete(fn) {
                                var firstValue = 1;
                                var lastValue = 3;
                                var result = fn([firstValue, null, lastValue]);
                                return sameValues(result, [firstValue, lastValue]);
                            }
                        },
                        {
                            name: 'statement-catch',
                            run: transpile`(function(value) {
                                try {
                                    throw value;
                                } catch ([a]) {
                                    return a;
                                }
                            })`,
                            complete(fn) {
                                var value = 1;
                                var result = fn([value]);
                                return result === value;
                            }
                        },
                        {
                            name: 'statement-for-in',
                            run: transpile`(function(value) {
                                for (var [a, b] in value);
                                return [a, b];
                            })`,
                            complete(fn) {
                                var value = {fo: 1};
                                var result = fn(value);
                                return sameValues(result, ['f', 'o']);
                            }
                        },
                        {
                            name: 'statement-for-of',
                            run: transpile`(function(iterable) {
                                for(var [a, b] of iterable);
                                return [a, b];
                            })`,
                            complete(fn) {
                                var data = [0, 1];
                                var result = fn([data]);
                                return sameValues(result, data);
                            }
                        },
                        {
                            name: 'trailing-commas',
                            run: transpile`(function(value) {
                                var [a,] = value;
                                return a;
                            })`,
                            complete(fn) {
                                var value = 0;
                                var result = fn([value]);
                                return result === value;
                            }
                        }
                    ]
                },
                {
                    name: 'object-notation',
                    run: transpile`(function(value) {
                        var {a} = value;
                        return a;
                    })`,
                    complete: every(
                        function(fn) {
                            var value = 1;
                            var result = fn({a: value});
                            return result === value;
                        },
                        function(fn) {
                            var value = 2;
                            // the expected behaviour is
                            // var {a} = 2;
                            // leads to a = 2.constructor.prototype.a;
                            var prototypeValue = 'foo';
                            var primitivePrototype = value.constructor.prototype;
                            primitivePrototype.a = prototypeValue;
                            var result = fn(value);
                            delete primitivePrototype.a;

                            return result === prototypeValue;
                        },
                        expectThrow(
                            function(fn) {
                                fn(null);
                            },
                            {
                                name: 'TypeError'
                            }
                        ),
                        expectThrow(
                            function(fn) {
                                fn(undefined);
                            },
                            {
                                name: 'TypeError'
                            }
                        )
                    ),
                    children: [
                        {
                            name: 'computed-properties',
                            run: transpile`(function(name, value) {
                                var {[name]: a} = value;
                                return a;
                            })`,
                            complete(fn) {
                                var name = 'a';
                                var value = 1;
                                var object = {};
                                object[name] = value;
                                var result = fn(name, object);
                                return result === value;
                            }
                        },
                        {
                            name: 'default',
                            run: transpile`(function(defaultValues, value) {
                                var {a = defaultValues.a, b = defaultValues.b, c = defaultValues.c} = value;
                                return [a, b, c];
                            })`,
                            complete(fn) {
                                var defaultA = 1;
                                var defaultB = 2;
                                var defaultC = 3;
                                var a = 0;
                                var result = fn(
                                    {
                                        a: defaultA,
                                        b: defaultB,
                                        c: defaultC
                                    },
                                    {
                                        a: a,
                                        c: undefined
                                    }
                                );
                                return sameValues(result, [a, defaultB, defaultC]);
                            },
                            children: [
                                {
                                    name: 'let-temporal-dead-zone',
                                    run: transpile`(function() {
                                        let {c = c} = {};
                                        let {c = d, d} = {d: 1};
                                    })`,
                                    crash(error) {
                                        return error instanceof Error;
                                    }
                                }
                            ]
                        },
                        {
                            name: 'double-dot-as',
                            run: transpile`(function(value) {
                                var {x:a} = value;
                                return a;
                            })`,
                            complete(fn) {
                                var value = 1;
                                var result = fn({x: value});
                                return result === value;
                            }
                        },
                        {
                            name: 'statement-catch',
                            run: transpile`(function(value) {
                                try {
                                    throw value;
                                } catch ({a}) {
                                    return a;
                                }
                            })`,
                            complete(fn) {
                                var value = 1;
                                var result = fn({a: value});
                                return result === value;
                            }
                        },
                        {
                            name: 'trailing-commas',
                            run: transpile`(function(value) {
                                var {a,} = value;
                                return a;
                            })`,
                            complete(fn) {
                                var value = 1;
                                var result = fn({a: value});
                                return result === value;
                            }
                        }
                    ]
                }
            ],
            dependentChildren: [
                {
                    name: 'array-notation-chain-object-notation',
                    run: transpile`(function(array, object) {
                        var [a] = array, {b} = object;
                        return [a, b];
                    })`,
                    complete(fn) {
                        var value = 1;
                        var result = fn([value], {b: value});
                        return sameValues(result, [value, value]);
                    }
                },
                {
                    name: 'array-notation-nest-object-notation',
                    run: transpile`(function(value) {
                        var [{a}] = value;
                        return a;
                    })`,
                    complete(fn) {
                        var value = 1;
                        var result = fn([{a: value}]);
                        return result === value;
                    }
                },
                {
                    name: 'object-notation-nest-array-notation',
                    run: transpile`(function(value) {
                        var {a:[a]} = value;
                        return a;
                    })`,
                    complete(fn) {
                        var value = 1;
                        var result = fn({a: [value]});
                        return result === value;
                    }
                }
            ]
        },
        {
            name: 'parameters',
            children: [
                {
                    name: 'array-notation',
                    run: transpile`(function([a]) {
                        return a;
                    })`,
                    complete: every(
                        function(fn) {
                            var value = 1;
                            var result = fn([value]);
                            return result === value;
                        },
                        function(fn) {
                            return fn.length === 1;
                        }
                    ),
                    children: [
                        {
                            name: 'new-function',
                            skipped: true,
                            run: function() {
                                return new Function( // eslint-disable-line no-new-func
                                    '[a]',
                                    'return a;'
                                );
                            },
                            complete(fn) {
                                var value = 1;
                                var result = fn([value]);
                                return result === value;
                            }
                        }
                    ]
                },
                {
                    name: 'object-notation',
                    run: transpile`(function({a}) {
                        return a;
                    })`,
                    complete: every(
                        function(fn) {
                            var value = 1;
                            var result = fn({a: value});
                            return result === value;
                        },
                        function(fn) {
                            return fn.length === 1;
                        }
                    ),
                    children: [
                        {
                            name: 'new-function',
                            skipped: true,
                            run: function() {
                                return new Function( // eslint-disable-line no-new-func
                                    '{a}',
                                    'return a;'
                                );
                            },
                            complete(fn) {
                                var value = 1;
                                var result = fn({a: value});
                                return result === value;
                            }
                        }
                    ]
                }
            ]
        }
    ]
};

export default test;
