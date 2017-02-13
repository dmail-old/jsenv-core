/* eslint-env browser, node */
/* globals jsenv */

(function() {
    var Predicate = jsenv.Predicate;
    var Iterable = jsenv.Iterable;

    function transpile(strings) {
        var result;
        var raw = strings.raw;
        var i = 0;
        var j = raw.length;
        result = raw[i];
        i++;
        while (i < j) {
            result += arguments[i];
            result += raw[i];
            i++;
        }
        return jsenv.createSourceCode(result);
    }
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
    function createIterableObject(arr, methods) {
        var j = arr.length;
        var iterable = {};
        iterable[Symbol.iterator] = function() {
            var i = -1;
            var iterator = {
                next: function() {
                    i++;
                    return {
                        value: i === j ? undefined : arr[i],
                        done: i === j
                    };
                }
            };
            jsenv.assign(iterator, methods || {});
            iterator.iterable = iterable;

            return iterator;
        };
        return iterable;
    }
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

    /*
    this is all about mapping
    https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
    with
    https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
    https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js
    */
    jsenv.registerFeatures(function(register) {
        /*
        if (jsenv.isBrowser() === false) {
            implementation.exclude('node-list');
            // etc
            // en gros on exclu certains features quand on est pas dans le browser
        }
        */

        register('let', {
            code: transpile`(function(value) {
                let result = value;
                return result;
            })`,
            pass: function(fn) {
                var value = 123;
                return fn(value) === value;
            }
        }).ensure(function(register) {
            register('throw-statement', {
                code: transpile`(function() {
                    if (true) let result = 1;
                })`,
                fail: function(error) {
                    return error.name === 'SyntaxError';
                }
            });
            register('temporal-dead-zone', {
                code: transpile`(function(value) {
                    var result;
                    function fn() {
                        result = foo;
                    }
                    let foo = value;
                    fn();
                    return result;
                })`,
                pass: function(fn) {
                    var value = 10;
                    return fn(value) === value;
                }
            });
            register('scoped', {
                code: transpile`(function(outsideValue, insideValue) {
                    let result = outsideValue;
                    {
                        let result = insideValue;
                    }
                    return result;
                })`,
                pass: function(fn) {
                    var outsideValue = 0;
                    var insideValue = 1;
                    return fn(outsideValue, insideValue) === outsideValue;
                }
            });
            register('scoped-for-statement', {
                code: transpile`(function(outsideValue, insideValue) {
                    let result = outsideValue;
                    for(let result = insideValue; false;) {}
                    return result;
                })`,
                pass: function(fn) {
                    var outsideValue = 0;
                    var insideValue = 1;
                    return fn(outsideValue, insideValue) === outsideValue;
                }
            });
            register('scoped-for-body', {
                code: transpile`(function(iterable) {
                    var scopes = [];
                    for(let i in iterable) {
                        scopes.push(function() {
                            return i;
                        });
                    }
                    return scopes;
                })`,
                pass: function(fn) {
                    var iterable = [0, 1];
                    var scopes = fn(iterable);
                    var scopeValues = Iterable.map(scopes, function(scope) {
                        return scope();
                    });
                    return sameValues(scopeValues, collectKeys(iterable));
                }
            });
        });

        register('computed-properties', {
            code: transpile`(function(name, value) {
                return {[name]: value};
            })`,
            pass: function(fn) {
                var name = 'y';
                var value = 1;
                return fn(name, value)[name] === value;
            }
        });

        register('shorthand-properties', {
            code: transpile`(function(a, b) {
                return {a, b};
            })`,
            pass: function(fn) {
                var a = 1;
                var b = 2;
                var result = fn(a, b);

                return (
                    result.a === a &&
                    result.b === b
                );
            }
        });

        register('shorthand-methods', {
            code: transpile`(function() {
                return {
                    y() {}
                };
            })`,
            pass: function(fn) {
                var result = fn();
                return typeof result.y === 'function';
            }
        });

        register('destructuring-declaration-array', {
            code: transpile`(function(value) {
                var [a] = value;
                return a;
            })`,
            pass: function(fn) {
                var value = 1;
                return fn([value]) === value;
            }
        }).ensure(function(register) {
            register('trailing-commas', {
                code: transpile`(function(value) {
                    var [a,] = value;
                    return a;
                })`,
                pass: function(fn) {
                    var value = 0;
                    return fn([value]) === value;
                }
            });
            register('iterable', {
                code: transpile`(function(value) {
                    var [a, b, c] = value;
                    return [a, b, c];
                })`,
                pass: function(fn) {
                    var data = [1, 2];
                    var iterable = createIterableObject(data);

                    return sameValues(fn(iterable), [1, 2, undefined]);
                }
            }).ensure(function(register) {
                register('instance', {
                    pass: function(fn) {
                        var data = [1, 2];
                        var iterable = createIterableObject(data);
                        var instance = Object.create(iterable);

                        return sameValues(fn(instance), [1, 2, undefined]);
                    }
                });
            });
            register('sparse', {
                code: transpile`(function(value) {
                    var [a, ,b] = value;
                    return [a, b];
                })`,
                pass: function(fn) {
                    var firstValue = 1;
                    var lastValue = 3;
                    var result = fn([firstValue, null, lastValue]);
                    return sameValues(result, [firstValue, lastValue]);
                }
            });
            register('nested', {
                code: transpile`(function(value) {
                    var [[a]] = value;
                    return a;
                })`,
                pass: function(fn) {
                    var value = 1;
                    return fn([[value]]) === value;
                }
            });
            register('for-in-statement', {
                code: transpile`(function(value) {
                    for (var [a, b] in value);
                    return [a, b];
                })`,
                pass: function(fn) {
                    var value = {fo: 1};
                    return sameValues(fn(value), ['f', 'o']);
                }
            });
            register('for-of-statement', {
                dependencies: ['for-of'],
                code: transpile`(function(iterable) {
                    for(var [a, b] of iterable);
                    return [a, b];
                })`,
                pass: function(fn) {
                    var data = [0, 1];
                    return sameValues(fn([data]), data);
                }
            });
            register('catch-statement', {
                code: transpile`(function(value) {
                    try {
                        throw value;
                    } catch ([a]) {
                        return a;
                    }
                })`,
                pass: function(fn) {
                    var value = 1;
                    return fn([value]) === value;
                }
            });
            register('rest', {
                code: transpile`(function(value) {
                    var [a, ...b] = value;
                    return [a, b];
                })`,
                pass: function(fn) {
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
            });
            register('default', {
                code: transpile`(function(defaultValues, values) {
                    var [a = defaultValues[0], b = defaultValues[1], c = defaultValues[2]] = values;
                    return [a, b, c];
                })`,
                pass: function(fn) {
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
            });
        });
        register('destructuring-declaration-object', {
            code: transpile`(function(value) {
                var {a} = value;
                return a;
            })`,
            pass: function(fn) {
                var value = 1;
                return fn({a: value}) === value;
            }
        }).ensure(function(register) {
            register('throw-null', {
                pass: Predicate.fails(function(fn) {
                    fn(null);
                }, {name: 'TypeError'})
            });
            register('throw-undefined', {
                pass: Predicate.fails(function(fn) {
                    fn(undefined);
                }, {name: 'TypeError'})
            });
            register('primitive-return-prototype', {
                pass: function(fn) {
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
                }
            });
            register('trailing-commas', {
                code: transpile`(function(value) {
                    var {a,} = value;
                    return a;
                })`,
                pass: function(fn) {
                    var value = 1;
                    return fn({a: value}) === value;
                }
            });
            register('double-dot-as', {
                code: transpile`(function(value) {
                    var {x:a} = value;
                    return a;
                })`,
                pass: function(fn) {
                    var value = 1;
                    return fn({x: value}) === value;
                }
            });
            register('computed-properties', {
                dependencies: ['computed-properties'],
                code: transpile`(function(name, value) {
                    var {[name]: a} = value;
                    return a;
                })`,
                pass: function(fn) {
                    var name = 'a';
                    var value = 1;
                    var object = {};
                    object[name] = value;
                    return fn(name, object) === value;
                }
            });
            register('catch-statement', {
                code: transpile`(function(value) {
                    try {
                        throw value;
                    } catch ({a}) {
                        return a;
                    }
                })`,
                pass: function(fn) {
                    var value = 1;
                    return fn({a: value}) === value;
                }
            });
            register('default', {
                code: transpile`(function(defaultValues, value) {
                    var {a = defaultValues.a, b = defaultValues.b, c = defaultValues.c} = value;
                    return [a, b, c];
                })`,
                pass: function(fn) {
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
                }
            });
            register('default-let-temporal-dead-zone', {
                dependencies: ['let'],
                code: transpile`(function() {
                    let {c = c} = {};
                    let {c = d, d} = {d: 1};
                })`,
                fail: function(error) {
                    return error instanceof Error;
                }
            });
        });
        register('destructuring-declaration-array-chain-object', {
            dependencies: [
                'destructuring-declaration-array',
                'destructuring-declaration-object'
            ],
            code: transpile`(function(array, object) {
                var [a] = array, {b} = object;
                return [a, b];
            })`,
            pass: function(fn) {
                var value = 1;
                return sameValues(fn([value], {b: value}), [value, value]);
            }
        });
        register('destructuring-declaration-array-nest-object', {
            dependencies: [
                'destructuring-declaration-array',
                'destructuring-declaration-object'
            ],
            code: transpile`(function(value) {
                var [{a}] = value;
                return a;
            })`,
            pass: function(fn) {
                var value = 1;
                return fn([{a: value}]) === value;
            }
        });
        register('destructuring-declaration-object-nest-array', {
            dependencies: [
                'destructuring-declaration-array',
                'destructuring-declaration-object',
                'destructuring-declaration-object-double-dot-as'
            ],
            code: transpile`(function(value) {
                var {a:[a]} = value;
                return a;
            })`,
            pass: function(fn) {
                var value = 1;
                return fn({a: [value]}) === value;
            }
        });
        register('destructuring-assignment-array', {
            code: transpile`(function(a, b) {
                [b, a] = [a, b];
                return [a, b];
            })`,
            pass: function(fn) {
                var a = 1;
                var b = 2;
                return sameValues(fn(a, b), [b, a]);
            }
        }).ensure(function(register) {
            register('empty', {
                code: transpile`(function() {
                    [] = [1,2];
                })`,
                pass: function(fn) {
                    fn();
                    return true;
                }
            });
            register('rest-nest', {
                code: transpile`(function(first, middle, last) {
                    var value = [first, middle, last];
                    var head;
                    var tail;
                    [head, ...[value[2], tail]] = value;
                    return [value, head, tail];
                })`,
                pass: function(fn) {
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
            });
            register('expression-return', {
                code: transpile`(function(value) {
                    var a;
                    return ([a] = value);
                })`,
                pass: function(fn) {
                    var value = [];
                    return fn(value) === value;
                }
            });
            register('chain', {
                code: transpile`(function(value) {
                    var a, b;
                    ([a] = [b] = [value]);
                    return [a, b];
                })`,
                pass: function(fn) {
                    var value = 1;
                    return sameValues(fn(value), [value, value]);
                }
            });
        });
        register('destructuring-assignment-object', {
            code: transpile`(function(value) {
                ({a} = {a: value});
                return a;
            })`,
            pass: function(fn) {
                var value = 1;
                return fn(value) === value;
            }
        }).ensure(function(register) {
            register('empty', {
                code: transpile`(function() {
                    ({} = {a:1, b:2});
                })`,
                pass: function(fn) {
                    fn();
                    return true;
                }
            });
            register('expression-return', {
                code: transpile`(function(value) {
                    var a;
                    return ({a} = value);
                })`,
                pass: function(fn) {
                    var value = {};
                    return fn(value) === value;
                }
            });
            register('throw-left-parenthesis', {
                code: transpile`(function(value) {
                    var a;
                    ({a}) = value;
                })`,
                fail: function(error) {
                    return error instanceof SyntaxError;
                }
            });
            register('chain', {
                code: transpile`(function(value) {
                    var a, b;
                    ({a} = {b} = {a: value, b: value});
                    return [a, b];
                })`,
                pass: function(fn) {
                    var value = 1;
                    return sameValues(fn(value), [value, value]);
                }
            });
        });
        register('destructuring-parameters-array', {
            code: transpile`(function([a]) {
                return a;
            })`,
            pass: function(fn) {
                var value = 1;
                return fn([value]) === value;
            }
        }).ensure(function(register) {
            register('function-length', {
                pass: function(fn) {
                    return fn.length === 1;
                }
            });
            register('new-function', {
                code: function() {
                    return new Function( // eslint-disable-line no-new-func
                        '[a]',
                        'return a;'
                    );
                },
                pass: function(fn) {
                    var value = 1;
                    return fn([value]) === value;
                }
            });
        });
        register('destructuring-parameters-object', {
            code: transpile`(function({a}) {
                return a;
            })`,
            pass: function(fn) {
                var value = 1;
                return fn({a: value}) === value;
            }
        }).ensure(function(register) {
            register('new-function', {
                code: function() {
                    return new Function( // eslint-disable-line no-new-func
                        '{a}',
                        'return a;'
                    );
                },
                pass: function(fn) {
                    var value = 1;
                    return fn({a: value}) === value;
                }
            });
            register('function-length', {
                code: transpile`(function({a}) {})`,
                pass: function(fn) {
                    return fn.length === 1;
                }
            });
        });

        register('spread-function-call', {
            code: transpile`(function(method, args) {
                return method(...args);
            })`,
            pass: function(fn) {
                var method = Math.max;
                var args = [1, 2, 3];

                return fn(method, args) === method.apply(null, args);
            }
        }).ensure(function(register) {
            register('throw-non-iterable', {
                pass: Predicate.fails(function(fn) {
                    fn(Math.max, true);
                })
            });
            register('iterable', {
                dependencies: [
                    'symbol-iterator'
                ],
                pass: function(fn) {
                    var method = Math.max;
                    var data = [1, 2, 3];
                    var iterable = createIterableObject(data);

                    return fn(method, iterable) === method.apply(null, data);
                }
            });
            register('iterable-instance', {
                pass: function(fn) {
                    var method = Math.max;
                    var data = [1, 2, 3];
                    var iterable = createIterableObject(data);
                    var instance = Object.create(iterable);

                    return fn(method, instance) === method.apply(null, data);
                }
            });
        });
        register('spread-literal-array', {
            code: transpile`(function(value) {
                return [...value];
            })`,
            pass: function(fn) {
                var value = [1, 2, 3];
                return sameValues(fn(value), value);
            }
        }).ensure(function(register) {
            register('iterable', {
                dependencies: [
                    'symbol-iterator'
                ],
                pass: function(fn) {
                    var data = [1, 2, 3];
                    var iterable = createIterableObject(data);
                    return sameValues(fn(iterable), data);
                }
            });
            register('iterable-instance', {
                pass: function(fn) {
                    var data = [1, 2, 3];
                    var iterable = createIterableObject(data);
                    var instance = Object.create(iterable);
                    return sameValues(fn(instance), data);
                }
            });
        });

        register('function-default-parameters', {
            code: transpile`(function(defaultA, defaultB) {
                return function(a = defaultA, b = defaultB) {
                    return [a, b];
                };
            })`,
            pass: function(fn) {
                var defaultA = 1;
                var defaultB = 2;
                var a = 3;
                var result = fn(defaultA, defaultB)(a);
                return sameValues(result, [a, defaultB]);
            }
        }).ensure(function(register) {
            register('explicit-undefined', {
                pass: function(fn) {
                    var defaultA = 1;
                    var defaultB = 2;
                    var a;
                    var b = 4;
                    var result = fn(defaultA, defaultB)(a, b);
                    return sameValues(result, [defaultA, b]);
                }
            });
            register('refer-previous', {
                code: transpile`(function(defaultValue) {
                    return function(a = defaultValue, b = a) {
                        return [a, b];
                    };
                })`,
                pass: function(fn) {
                    var defaultValue = 1;
                    var result = fn(defaultValue)();
                    return sameValues(result, [defaultValue, defaultValue]);
                }
            });
            register('arguments', {
                code: transpile`(function(defaultValue) {
                    return function(a = defaultValue) {
                        a = 10;
                        return arguments;
                    };
                })`,
                pass: function(fn) {
                    var defaultValue = 1;
                    var value = 2;
                    var result = fn(defaultValue)(value);
                    return sameValues(result, [value]);
                }
            });
            register('temporal-dead-zone', {
                code: transpile`(function() {
                    (function(a = a) {}());
                    (function(a = b, b){}());
                })`,
                pass: Predicate.fails(function(fn) {
                    fn();
                })
            });
            register('scope-own', {
                code: transpile`(function(a = function() {
                    return typeof b;
                }) {
                    var b = 1;
                    return a();
                })`,
                pass: function(fn) {
                    return fn() === 'undefined';
                }
            });
            register('new-function', {
                code: function() {
                    return function(defaultA, defaultB) {
                        return new Function( // eslint-disable-line no-new-func
                            "a = " + defaultA, "b = " + defaultB,
                            "return [a, b];"
                        );
                    };
                },
                pass: function(fn) {
                    var defaultA = 1;
                    var defaultB = 2;
                    var a = 3;
                    return sameValues(fn(defaultA, defaultB)(a), [a, defaultB]);
                }
            });
        });

        register('function-rest-parameters', {
            code: transpile`(function(foo, ...rest) {
                return [foo, rest];
            })`,
            pass: function(fn) {
                var first = 1;
                var second = 2;
                var result = fn(first, second);
                return (
                    result[0] === first &&
                    sameValues(result[1], [second])
                );
            }
        }).ensure(function(register) {
            register('throw-setter', {
                code: transpile`(function() {
                    return {
                        set e(...args) {}
                    };
                })`,
                fail: function(error) {
                    return error instanceof Error;
                }
            });
            register('length', {
                code: transpile`(function() {
                    return [
                        function(a, ...b) {},
                        function(...c) {}
                    ];
                })`,
                pass: function(fn) {
                    var result = fn();

                    return (
                        result[0].length === 1 &&
                        result[1].length === 0
                    );
                }
            });
            register('arguments', {
                code: transpile`(function(foo, ...rest) {
                    foo = 10;
                    return arguments;
                })`,
                pass: function(fn) {
                    var first = 1;
                    var second = 2;
                    var result = fn(first, second);
                    return sameValues(result, [first, second]);
                }
            });
            register('new-function', {
                code: function() {
                    return new Function( // eslint-disable-line no-new-func
                        "a", "...rest",
                        "return [a, rest]"
                    );
                },
                pass: function(fn) {
                    var first = 1;
                    var second = 2;
                    var result = fn(first, second);
                    return (
                        result[0] === first &&
                        sameValues(result[1], [second])
                    );
                }
            });
        });

        // register('spread-function-call-generator', {
        //     // dependencies: ['yield'],
        //     args: '\
        //         return {\
        //             value: (function*() {\
        //                 yield 1;\
        //                 yield 2;\
        //                 yield 3;\
        //             }())\
        //         };\
        //     ',
        //     pass: function(result) {
        //         return result === 3;
        //     }
        // });
        // register('spread-literal-array-generator', {
        //     args: '\
        //         return {\
        //             value: (function*() {\
        //                 yield 1;\
        //                 yield 2;\
        //                 yield 3;\
        //             }())\
        //         };\
        //     ',
        //     pass: function(result) {
        //         return sameValues(result, [1, 2, 3]);
        //     }
        // });
        // register('for-of-generator', {
        //     // dependencies: ['yield'],
        //     body: '\
        //         var result = "";\
        //         var iterable = (function*() {\
        //             yield 1;\
        //             yield 2;\
        //             yield 3;\
        //         }());\
        //         for (var item of iterable) {\
        //             result += item;\
        //         }\
        //         return result;\
        //     ',
        //     pass: function(result) {
        //         return result === '123';
        //     }
        // });
        // register('destructuring-assignement-generator')
        // https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js#L10247
    });
})();
