import '/symbol/iterator/test.js';
import '/array/prototype/symbol-iterator.js';
import '/string/prototype/symbol-iterator.js';
import '/object/create/test.js';
import '/let/test.js';

import {expect, transpile, expectThrow, sameValues, createIterableObject} from '/test-helpers.js';

const test = expect({
    'assignment': expect({
        'array-notation': expect({
            'compiles': transpile`(function(a, b) {
                [b, a] = [a, b];
                return [a, b];
            })`,
            'runs'(fn) {
                var a = 1;
                var b = 2;
                var result = fn(a, b);
                return sameValues(result, [b, a]);
            },
            'chain': expect({
                'compiles': transpile`(function(value) {
                    var a, b;
                    ([a] = [b] = [value]);
                    return [a, b];
                })`,
                'runs': fn => {
                    var value = 1;
                    var result = fn(value);
                    return sameValues(result, [value, value]);
                }
            }),
            'empty': expect({
                'compiles': transpile`(function() {
                    [] = [1,2];
                })`,
                'runs': fn => fn()
            }),
            'expression-return': expect({
                'compiles': transpile`(function(value) {
                    var a;
                    return ([a] = value);
                })`,
                'runs': fn => {
                    var value = [];
                    var result = fn(value);
                    return result === value;
                }
            }),
            'rest-nest': expect({
                'compiles': transpile`(function(first, middle, last) {
                    var value = [first, middle, last];
                    var head;
                    var tail;
                    [head, ...[value[2], tail]] = value;
                    return [value, head, tail];
                })`,
                'runs': fn => {
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
            })
        }),
        'object-notation': expect({
            'compiles': () => transpile`(function(value) {
                ({a} = {a: value});
                return a;
            })`,
            'runs': fn => {
                var value = 1;
                var result = fn(value);
                return result === value;
            },
            'chain': expect({
                'compiles': () => transpile`(function(value) {
                    var a, b;
                    ({a} = {b} = {a: value, b: value});
                    return [a, b];
                })`,
                'runs': fn => {
                    var value = 1;
                    var result = fn(value);
                    return sameValues(result, [value, value]);
                }
            }),
            'empty': expect({
                'compiles': () => transpile`(function() {
                    ({} = {a:1, b:2});
                })`,
                'runs': fn => fn()
            }),
            'expression-return': expect({
                'compiles': () => transpile`(function(value) {
                    var a;
                    return ({a} = value);
                })`,
                'runs': fn => {
                    var value = {};
                    var result = fn(value);
                    return result === value;
                }
            }),
            'rest-nest': expect({
                'compiles': () => transpile`(function(first, middle, last) {
                    var value = [first, middle, last];
                    var head;
                    var tail;
                    [head, ...[value[2], tail]] = value;
                    return [value, head, tail];
                })`,
                'runs': fn => {
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
            }),
            'throw-left-parenthesis': expectThrow(
                () => transpile`(function(value) {
                    var a;
                    ({a}) = value;
                })`,
                {
                    name: 'SyntaxError'
                }
            )
        })
    }),
    'declaration': expect({
        'array-notation': expect({
            'compiles': transpile`(function(value) {
                var [a] = value;
                return a;
            })`,
            'runs': fn => {
                var value = 1;
                var result = fn([value]);
                return result === value;
            },
            'default': expect({
                'compiles': transpile`(function(defaultValues, values) {
                    var [a = defaultValues[0], b = defaultValues[1], c = defaultValues[2]] = values;
                    return [a, b, c];
                })`,
                'runs': fn => {
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
            }),
            'expression-return': expect({
                'compiles': transpile`(function(value) {
                    var a;
                    return ([a] = value);
                })`,
                'runs': fn => {
                    var value = [];
                    var result = fn(value);
                    return result === value;
                }
            }),
            'iterable': expect({
                'compiles': transpile`(function(value) {
                    var [a, b, c] = value;
                    return [a, b, c];
                })`,
                'runs': fn => {
                    var data = [1, 2];
                    var iterable = createIterableObject(data);
                    var result = fn(iterable);
                    var instanceResult = fn(Object.create(iterable));

                    return (
                        sameValues(result, [1, 2, undefined]) &&
                        sameValues(instanceResult, [1, 2, undefined])
                    );
                }
            }),
            'nested': expect({
                'compiles': transpile`(function(value) {
                    var [[a]] = value;
                    return a;
                })`,
                'runs': fn => {
                    var value = 1;
                    var result = fn([[value]]);
                    return result === value;
                }
            }),
            'rest': expect({
                'compiles': transpile`(function(value) {
                    var [a, ...b] = value;
                    return [a, b];
                })`,
                'runs': fn => {
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
            }),
            'sparse': expect({
                'compiles': transpile`(function(value) {
                    var [a, ,b] = value;
                    return [a, b];
                })`,
                'runs': fn => {
                    var firstValue = 1;
                    var lastValue = 3;
                    var result = fn([firstValue, null, lastValue]);
                    return sameValues(result, [firstValue, lastValue]);
                }
            }),
            'statement-catch': expect({
                'compiles': () => transpile`(function(value) {
                    try {
                        throw value;
                    } catch ([a]) {
                        return a;
                    }
                })`,
                'runs': fn => {
                    var value = 1;
                    var result = fn([value]);
                    return result === value;
                }
            }),
            'statement-for-in': expect({
                'compiles': () => transpile`(function(value) {
                    for (var [a, b] in value);
                    return [a, b];
                })`,
                'runs': fn => {
                    var value = {fo: 1};
                    var result = fn(value);
                    return sameValues(result, ['f', 'o']);
                }
            }),
            'statement-for-of': expect({
                'compiles': () => transpile`(function(iterable) {
                    for(var [a, b] of iterable);
                    return [a, b];
                })`,
                'runs': fn => {
                    var data = [0, 1];
                    var result = fn([data]);
                    return sameValues(result, data);
                }
            }),
            'trailing-commas': expect({
                'compiles': () => transpile`(function(value) {
                    var [a,] = value;
                    return a;
                })`,
                'runs': fn => {
                    var value = 0;
                    var result = fn([value]);
                    return result === value;
                }
            })
        }),
        'object-notation': expect({
            'compiles': transpile`(function(value) {
                var {a} = value;
                return a;
            })`,
            'runs': fn => {
                var value = 1;
                var result = fn({a: value});
                return result === value;
            },
            'return-prototype-on-primitive': fn => {
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
            'throw-on-null': expectThrow(
                fn => fn(null),
                {
                    name: 'TypeError'
                }
            ),
            'throw-on-undefined': expectThrow(
                fn => fn(undefined),
                {
                    name: 'TypeError'
                }
            ),
            'computed-properties': expect({
                'compiles': transpile`(function(name, value) {
                    var {[name]: a} = value;
                    return a;
                })`,
                'runs': fn => {
                    var name = 'a';
                    var value = 1;
                    var object = {};
                    object[name] = value;
                    var result = fn(name, object);
                    return result === value;
                }
            }),
            'default': expect({
                'compiles': transpile`(function(defaultValues, value) {
                    var {a = defaultValues.a, b = defaultValues.b, c = defaultValues.c} = value;
                    return [a, b, c];
                })`,
                'runs': fn => {
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
                'let-temporal-dead-zone': expectThrow(
                    transpile`(function() {
                        let {c = c} = {};
                        let {c = d, d} = {d: 1};
                    })`
                )
            }),
            'double-dot-as': expect({
                'compiles': transpile`(function(value) {
                    var {x:a} = value;
                    return a;
                })`,
                'runs': fn => {
                    var value = 1;
                    var result = fn({x: value});
                    return result === value;
                }
            }),
            'statement-catch': expect({
                'compiles': transpile`(function(value) {
                    try {
                        throw value;
                    } catch ({a}) {
                        return a;
                    }
                })`,
                'runs': fn => {
                    var value = 1;
                    var result = fn({a: value});
                    return result === value;
                }
            }),
            'trailing-commas': expect({
                'compiles': transpile`(function(value) {
                    var {a,} = value;
                    return a;
                })`,
                'runs': fn => {
                    var value = 1;
                    var result = fn({a: value});
                    return result === value;
                }
            })
        }),
        'array-notation-chain-object-notation': expect({
            'compiles': transpile`(function(array, object) {
                var [a] = array, {b} = object;
                return [a, b];
            })`,
            'runs': fn => {
                var value = 1;
                var result = fn([value], {b: value});
                return sameValues(result, [value, value]);
            }
        }),
        'array-notation-nest-object-notation': expect({
            'compiles': transpile`(function(value) {
                var [{a}] = value;
                return a;
            })`,
            'runs': fn => {
                var value = 1;
                var result = fn([{a: value}]);
                return result === value;
            }
        }),
        'object-notation-nest-array-notation': expect({
            'comiles': transpile`(function(value) {
                var {a:[a]} = value;
                return a;
            })`,
            'runs'(fn) {
                var value = 1;
                var result = fn({a: [value]});
                return result === value;
            }
        })
    }),
    'parameters': expect({
        'array-notation': expect({
            'compiles': transpile`(function([a]) {
                return a;
            })`,
            'runs'(fn) {
                var value = 1;
                var result = fn([value]);
                return result === value;
            },
            'length'(fn) {
                return fn.length === 1;
            }
        }),
        'object-notation': expect({
            'compiles': transpile`(function({a}) {
                return a;
            })`,
            'runs'(fn) {
                var value = 1;
                var result = fn({a: value});
                return result === value;
            },
            'length'(fn) {
                return fn.length === 1;
            }
        })
    })
});

export default test;
