/* globals jsenv */

(function() {
    function sameValues(a, b) {
        if (typeof a === 'string') {
            a = convertStringToArray(a);
        }
        if (typeof b === 'string') {
            b = convertStringToArray(b);
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
                    keys.push(Number(key));
                } else {
                    keys.push(key);
                }
            }
        }
        return keys;
    }
    // function collectValues(value) {
    //     var values = [];
    //     for (var key in value) {
    //         if (value.hasOwnProperty(key)) {
    //             values.push(value[key]);
    //         }
    //     }
    //     return values;
    // }
    function consumeIterator(iterator) {
        var values = [];
        var next = iterator.next();
        while (next.done === false) {
            values.push(next.value);
            next = iterator.next();
        }
        return values;
    }

    jsenv.provide(function registerStandardFeatures() {
        var standard = jsenv.registerStandard;

        standard('system', 'System');
        standard('promise', 'Promise');
        standard('promise-unhandled-rejection', function(Promise, settle) {
            var promiseRejectionEvent;
            var unhandledRejection = function(e) {
                promiseRejectionEvent = e;
            };

            if (jsenv.isBrowser()) {
                if ('onunhandledrejection' in window === false) {
                    return settle(false);
                }
                window.onunhandledrejection = unhandledRejection;
            } else if (jsenv.isNode()) {
                process.on('unhandledRejection', function(value, promise) {
                    unhandledRejection({
                        promise: promise,
                        reason: value
                    });
                });
            } else {
                return settle(false);
            }

            Promise.reject('foo');
            setTimeout(function() {
                var valid = (
                    promiseRejectionEvent &&
                    promiseRejectionEvent.reason === 'foo'
                );
                // to be fully compliant we shoudl ensure
                // promiseRejectionEvent.promise === the promise rejected above
                // BUT it seems corejs dos not behave that way
                // and I'm not 100% sure what is the expected promise object here
                settle(valid);
            }, 10); // engine has 10ms to trigger the event
        });
        standard('promise-rejection-handled', function(Promise, settle) {
            var promiseRejectionEvent;
            var rejectionHandled = function(e) {
                promiseRejectionEvent = e;
            };

            if (jsenv.isBrowser()) {
                if ('onrejectionhandled' in window === false) {
                    return settle(false);
                }
                window.onrejectionhandled = rejectionHandled;
            } else if (jsenv.isNode()) {
                process.on('rejectionHandled', function(promise) {
                    rejectionHandled({promise: promise});
                });
            } else {
                return settle(false);
            }

            var promise = Promise.reject('foo');
            setTimeout(function() {
                promise.catch(function() {});
                setTimeout(function() {
                    settle(
                        promiseRejectionEvent &&
                        promiseRejectionEvent.promise === promise
                    );
                    // node event emit the value
                    // so we can't check for
                    // promiseRejectionEvent.reason === 'foo'
                }, 10); // engine has 10ms to trigger the event
            });
        });
        standard('symbol', 'Symbol');
        standard('symbol-iterator', 'iterator');
        standard('symbol-to-primitive', 'toPrimitive');
        standard('object', 'Object');
        standard('object-get-own-property-descriptor', 'getOwnPropertyDescriptor');
        standard('object-assign', 'assign');
        standard('date', 'Date');
        standard('date-now', 'now');
        standard('date-prototype', 'prototype');
        standard('date-prototype-to-json', 'toJSON');
        // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-json.js
        standard('date-prototype-to-json-nan-return-null', function() {
            return new Date(NaN).toJSON() === null;
        });
        standard('date-prototype-to-json-use-to-iso-string', function() {
            var fakeDate = {
                toISOString: function() {
                    return 1;
                }
            };
            return Date.prototype.toJSON.call(fakeDate) === 1;
        });
        standard('date-prototype-to-iso-string', 'toISOString');
        // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-iso-string.js
        standard('date-prototype-to-iso-string-negative-5e13', function() {
            return new Date(-5e13 - 1).toISOString() === '0385-07-25T07:06:39.999Z';
        });
        standard('date-prototype-to-iso-string-nan-throw', Predicate.fails(function() {
            new Date(NaN).toISOString(); // eslint-disable-line no-unused-expressions
        }));
        standard('date-prototype-symbol-to-primitive', jsenv.implementation.get('symbol-to-primitive'));
        standard('date-prototype-to-string', 'toString');
        standard('date-prototype-to-string-nan-return-invalid-date', function() {
            // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-string.js
            return new Date(NaN).toString() === 'Invalid Date';
        });
        standard('array', 'Array');
        standard('array-prototype', 'prototype');
        standard('array-prototype-symbol-iterator', jsenv.implementation.get('symbol-iterator'));
        standard('array-prototype-symbol-iterator-sparse', function(arrayIterator) {
            var sparseArray = [,,]; // eslint-disable-line no-sparse-arrays, comma-spacing
            var iterator = arrayIterator.call(sparseArray);
            var values = consumeIterator(iterator);

            return sameValues(values, sparseArray);
        });

        standard('function', 'Function');
        standard('function-prototype', 'prototype');
        standard('function-prototype-name', 'name');
        standard('function-prototype-name-description', function() {
            var descriptor = Object.getOwnPropertyDescriptor(
                function f() {},
                'name'
            );

            return (
                descriptor.enumerable === false &&
                descriptor.writable === false &&
                descriptor.configurable === true
            );
        });

        standard('string', 'String');
        standard('string-prototype', 'prototype');
        standard('string-prototype-symbol-iterator', jsenv.implementation.get('symbol-iterator'));
        standard('string-prototype-symbol-iterator-basic', function(stringIterator) {
            var string = '1234';
            var iterator = stringIterator.call(string);
            var values = consumeIterator(iterator);

            return sameValues(values, string);
        });
        standard('string-prototype-symbol-iterator-astral', function(stringIterator) {
            var astralString = '𠮷𠮶';
            var iterator = stringIterator.call(astralString);
            var values = consumeIterator(iterator);

            return sameValues(values, astralString);
        });

        standard('url', 'URL');
        standard('url-search-params', 'URLSearchParams', true);

        /*
        if (jsenv.isBrowser() === false) {
            implementation.exclude('node-list');
            // etc
            // en gros on exclu certains features quand on est pas dans le browser
        }
        */
    });

    jsenv.provide(function registerSyntaxFeatures() {
        /*
        this is all about mapping
        https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
        with
        https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
        https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js
        */

        var registerSyntax = jsenv.registerSyntax;
        var groupNames = [];
        function group(name, groupScope) {
            if (name) {
                groupNames.push(name);
            }
            groupScope();
            if (name) {
                groupNames.pop();
            }
        }
        function syntax(name, descriptor) {
            if (arguments.length === 1) {
                descriptor = arguments[0];
                name = '';
            }

            if (groupNames.length) {
                if (name) {
                    name = groupNames.join('-') + '-' + name;
                } else {
                    name = groupNames.join('-');
                }
            }
            return registerSyntax(name, descriptor);
        }

        group('for-of', function() {
            syntax({
                dependencies: [
                    'array-prototype-symbol-iterator'
                ],
                config: [
                    [5]
                ],
                code: transpile`(function(value) {
                    var result = [];
                    for (var entry of value) {
                        result.push(entry);
                    }
                    return result;
                })`,
                test: function(result) {
                    return result[0] === 5;
                }
            });
            syntax('iterable', {
                dependencies: [
                    'symbol-iterator'
                ],
                config: function() {
                    return [
                        createIterableObject([1, 2, 3])
                    ];
                },
                test: function(result) {
                    return sameValues(result, [1, 2, 3]);
                }
            });
            syntax('iterable-instance', {
                config: function() {
                    return [
                        Object.create(createIterableObject([1, 2, 3]))
                    ];
                },
                test: function(result) {
                    return sameValues(result, [1, 2, 3]);
                }
            });
            syntax('iterable-return-called-on-break', {
                config: function() {
                    return [
                        createIterableObject([1], {
                            'return': function() { // eslint-disable-line
                                this.iterable.returnCalled = true;
                                return {};
                            }
                        })
                    ];
                },
                code: transpile`(function(value) {
                    for (var it of value) {
                        break;
                    }
                })`,
                test: function() {
                    return this.config[0].returnCalled;
                }
            });
            syntax('iterable-return-called-on-throw', {
                config: function() {
                    return [
                        createIterableObject([1], {
                            'return': function() { // eslint-disable-line
                                this.iterable.returnCalled = true;
                                return {};
                            }
                        }),
                        0
                    ];
                },
                code: transpile`(function(value, throwedValue) {
                    for (var it of value) {
                        throw throwedValue;
                    }
                })`,
                when: 'code-runtime-error',
                test: function(error) {
                    return (
                        error === this.config.throwedValue &&
                        this.config.value.returnCalled
                    );
                }
            });
        });

        group('const', function() {
            syntax({
                config: [
                    1
                ],
                code: transpile`(function(value) {
                    const result = value;
                    return result;
                })`,
                test: function(result) {
                    return result === this.config[0];
                }
            });
            syntax('throw-statement', {
                code: transpile`(function() {
                    if (true) const bar = 1;
                })`,
                when: 'code-compilation-error',
                test: function(error) {
                    return error instanceof Error;
                }
            });
            syntax('throw-redefine', {
                code: transpile`(function() {
                    const foo = 1;
                    foo = 2;
                })`,
                when: 'code-runtime-error',
                test: function(error) {
                    return error instanceof Error;
                }
            });
            syntax('temporal-dead-zone', {
                config: {
                    value: 10
                },
                code: tanspile`(function(value) {
                    var result;
                    function fn() {
                        result = foo;
                    }
                    const foo = value;
                    fn();
                    return result;
                })`,
                test: function(result) {
                    return result === this.config[0];
                }
            });
            syntax('scoped', {
                config: [
                    0,
                    1
                ],
                code: transpile`(function(outsideValue, insideValue) {
                    const result = outsideValue;
                    {
                        const result = insideValue;
                    }
                    return result;
                })`,
                test: function(result) {
                    return result === this.config[0];
                }
            });
            syntax('scoped-for-statement', {
                code: transpile`(function(outsideValue, insideValue) {
                    const foo = outsideValue;
                    for(const foo = insideValue; false;) {}
                    return foo;
                })`,
                test: function(result) {
                    return result === this.config[0];
                }
            });
            syntax('scoped-for-body', {
                config: [
                    [0, 1]
                ],
                code: transpile`(function(value) {
                    var scopes = [];
                    for(const i in value) {
                        scopes.push(function() {
                            return i;
                        });
                    }
                    return scopes;
                })`,
                test: function(result) {
                    var scopedValues = jsenv.Iterable.map(result, function(fn) {
                        return fn();
                    });
                    var value = this.config[0];
                    var expectedValues = [];
                    for (var i in value) { // eslint-disable-line guard-for-in
                        expectedValues.push(i);
                    }
                    return sameValues(scopedValues, expectedValues);
                }
            });
            syntax('scoped-for-of-body', {
                dependencies: ['for-of'],
                config: [
                    [0, 1]
                ],
                code: transpile`(function(value) {
                    var scopes = [];
                    for(const i of value) {
                        scopes.push(function() {
                            return i;
                        });
                    }
                    return scopes;
                })`,
                test: function(result) {
                    var scopedValues = jsenv.Iterable.map(result, function(fn) {
                        return fn();
                    });
                    return sameValues(scopedValues, collectKeys(this.config[0]));
                }
            });
        });

        group('let', function() {
            syntax({
                config: {
                    value: 123
                },
                code: transpile`(function(value) {
                    let result = value;
                    return result;
                })`,
                test: function(result) {
                    return result === this.config[0];
                }
            });
            syntax('throw-statement', {
                code: transpile`(function() {
                    if (true) let result = 1;
                })`,
                when: 'code-compilation-error',
                test: function(error) {
                    return error instanceof Error;
                }
            });
            syntax('temporal-dead-zone', {
                config: {
                    value: 10
                },
                code: transpile`(function(value) {
                    var result;
                    function fn() {
                        result = foo;
                    }
                    let foo = value;
                    fn();
                    return result;
                })`,
                test: function(result) {
                    return result === this.config[0];
                }
            });
            syntax('scoped', {
                config: [
                    0,
                    1
                ],
                code: transpile`(function(outsideValue, insideValue) {
                    let result = outsideValue;
                    {
                        let result = insideValue;
                    }
                    return result;
                })`,
                test: function(result) {
                    return result === this.config[0];
                }
            });
            syntax('scoped-for-statement', {
                code: transpile`(function(outsideValue, insideValue) {
                    let result = outsideValue;
                    for(let result = insideValue; false;) {}
                    return result;
                })`,
                test: function(result) {
                    return result === this.config[0];
                }
            });
            syntax('scoped-for-body', {
                config: [
                    [0, 1]
                ],
                code: transpile`(function(value) {
                    var scopes = [];
                    for(let i in value) {
                        scopes.push(function() {
                            return i;
                        });
                    }
                    return scopes;
                })`,
                test: function(result) {
                    var scopedValues = jsenv.Iterable.map(result, function(fn) {
                        return fn();
                    });
                    var value = this.config[0];
                    var expectedValues = [];
                    for (var i in value) { // eslint-disable-line guard-for-in
                        expectedValues.push(i);
                    }
                    return sameValues(scopedValues, expectedValues);
                }
            });
        });

        group('computed-properties', function() {
            syntax({
                config: [
                    'y',
                     1
                ],
                code: transpile`(function(name, value) {
                    return {[name]: value};
                })`,
                test: function(result) {
                    return result[this.config[0]] === this.config[1];
                }
            });
        });

        group('shorthand-properties', function() {
            syntax({
                config: [
                    1,
                    2
                ],
                code: transpile`(function(a, b) {
                    return {a, b};
                })`,
                test: function(result) {
                    return (
                        result.a === this.config[0] &&
                        result.b === this.config[1]
                    );
                }
            });
        });

        group('shorthand-methods', function() {
            syntax({
                config: [
                    {}
                ],
                code: transpile`(function(value) {
                    return {
                        y() {
                            return value;
                        }
                    };
                })`,
                test: function(result) {
                    return result.y() === this.config[0];
                }
            });
        });

        group('destructuring', function() {
            group('declaration', function() {
                group('array', function() {
                    syntax({
                        config: [
                            [1]
                        ],
                        code: transpile`(function(value) {
                            var [a] = value;
                            return a;
                        })`,
                        test: function(result) {
                            return result === this.config[0][0];
                        }
                    });
                    syntax('trailing-commas', {
                        code: transpile`(function(value) {
                            var [a,] = value;
                            return a;
                        })`,
                        test: function(result) {
                            return result === this.config[0][0];
                        }
                    });
                    syntax('iterable', {
                        config: [
                            createIterableObject([1, 2])
                        ],
                        code: transpile`(function(value) {
                            var [a, b, c] = value;
                            return [a, b, c];
                        })`,
                        test: function(result) {
                            return sameValues(result, [1, 2, undefined]);
                        }
                    });
                    syntax('iterable-instance', {
                        config: [
                            Object.create(createIterableObject([1, 2]))
                        ],
                        test: function(result) {
                            return sameValues(result, [1, 2, undefined]);
                        }
                    });
                    syntax('sparse', {
                        config: [
                            [1, 2, 3]
                        ],
                        code: transpile`(function(value) {
                            var [a, ,b] = value;
                            return [a, b];
                        })`,
                        test: function(result) {
                            return sameValues(result, [this.config[0][0], this.config[0][2]]);
                        }
                    });
                    syntax('nested', {
                        config: [
                            [[1]]
                        ],
                        code: transpile`(function(value) {
                            var [[a]] = value;
                            return a;
                        })`,
                        test: function(result) {
                            return result === this.config[0][0][0];
                        }
                    });
                    syntax('for-in-statement', {
                        config: [
                            {fo: 1}
                        ],
                        code: transpile`(function(value) {
                            for (var [a, b] in value);
                            return [a, b];
                        })`,
                        test: function(result) {
                            return result.join('') === 'fo';
                        }
                    });
                    syntax('for-of-statement', {
                        dependencies: ['for-of'],
                        config: [
                            [[0, 1]]
                        ],
                        code: transpile`(function(value) {
                            for(var [a, b] of value);
                            return [a, b];
                        })`,
                        test: function(result) {
                            return sameValues(result, this.config[0][0]);
                        }
                    });
                    syntax('catch-statement', {
                        config: [
                            [1]
                        ],
                        code: transpile`(function(value) {
                            try {
                                throw value;
                            } catch ([a]) {
                                return a;
                            }
                        })`,
                        test: function(result) {
                            return result === this.config[0][0];
                        }
                    });
                    syntax('rest', {
                        config: [
                            [1, 2, 3],
                            [4]
                        ],
                        code: transpile`(function(value, secondValue) {
                            var [a, ...b] = value;
                            var [c, ...d] = secondValue;
                            return [a, b, c, d];
                        })`,
                        test: function(result) {
                            return (
                                result[0] === this.config[0][0] &&
                                sameValues(result[1], this.config[0].slice(1)) &&
                                result[2] === this.config[1][0] &&
                                result[3] instanceof Array && result[3].length === 0
                            );
                        }
                    });
                    syntax('default', {
                        code: transpile`(function() {
                            var [a = 4, b = 5, c = 6] = [0,,undefined];
                            return [a, b, c];
                        })`,
                        test: function(result) {
                            return sameValues(result, [0, 5, 6]);
                        }
                    });
                });

                group('object', function() {
                    syntax({
                        config: [
                            {a: 1}
                        ],
                        code: transpile`(function(value) {
                            var {a} = value;
                            return a;
                        })`,
                        test: function(result) {
                            return result === this.config[0].a;
                        }
                    });
                    syntax('throw-null', {
                        config: [
                            null
                        ],
                        when: 'code-runtime-error',
                        test: function(result) {
                            return result instanceof TypeError;
                        }
                    });
                    syntax('throw-undefined', {
                        config: [
                            undefined
                        ],
                        when: 'code-runtime-error',
                        test: function(result) {
                            return result instanceof TypeError;
                        }
                    });
                    syntax('primitive-return-prototype', {
                        config: function() {
                            var value = 2;
                            var prototypeValue = 'foo';
                            value.constructor.prototype.a = prototypeValue;
                            return [
                                prototypeValue,
                                value
                            ];
                        },
                        test: function(result) {
                            delete this.config[1].constructor.prototype.a;
                            return result === this.config[0];
                        }
                    });
                    syntax('trailing-commas', {
                        config: [
                            1
                        ],
                        code: transpile`(function(value) {
                            var {a,} = {a:value};
                            return a;
                        })`,
                        test: function(result) {
                            return result === this.config[0];
                        }
                    });
                    syntax('double-dot-as', {
                        config: [
                            {x: 1}
                        },
                        code: transpile`(function(value) {
                            var {x:a} = value;
                            return a;
                        })`,
                        test: function(result) {
                            return result === this.config[0].x;
                        }
                    });
                    syntax('computed-properties', {
                        dependencies: ['computed-properties'],
                        config: [
                            'b',
                            {b: 1}
                        },
                        code: transpile`(function(value) {
                            var {[name]: a} = value;
                            return a;
                        })`,
                        test: function(result) {
                            return result === this.config[1][this.config[0];
                        }
                    });
                    syntax('catch-statement', {
                        config: [
                            {a: 1}
                        ],
                        code: transpile`(function(value) {
                            try {
                                throw value;
                            } catch ({a}) {
                                return a;
                            }
                        })`,
                        test: function(result) {
                            return result === this.config[0].a;
                        }
                    });
                    syntax('default', {
                        code: transpile`(function() {
                            var {a = 4, b = 5, c = 6} = {a: 0, c: undefined};
                            return [a, b, c];
                        })`,
                        test: function(result) {
                            return sameValues(result, [0, 5, 6]);
                        }
                    });
                    syntax('default-let-temporal-dead-zone', {
                        dependencies: ['let'],
                        code: transpile`(function() {
                            let {c = c} = {};
                            let {c = d, d} = {d: 1};
                        })`,
                        when: 'code-compilation-error',
                        test: function(result) {
                            return result instanceof Error;
                        }
                    });
                });

                syntax('array-chain-object', {
                    dependencies: [
                        'destructuring-declaration-array',
                        'destructuring-declaration-object'
                    ],
                    config: [
                        [0, 1],
                        {c: 2, d: 3}
                    },
                    code: transpile`(function(array, object) {
                        var [a,b] = array, {c,d} = object;
                        return [a, b, c, d];
                    })`,
                    test: function(result) {
                        return sameValues(result, [
                            this.config[0][0],
                            this.config[0][1],
                            this.config[1].c,
                            this.config[1].d
                        ]);
                    }
                });
                syntax('array-nest-object', {
                    dependencies: [
                        'destructuring-declaration-array',
                        'destructuring-declaration-object'
                    ],
                    config: [
                        [{a: 1}]
                    ],
                    code: transpile`(function(value) {
                        var [{a}] = value;
                        return a;
                    })`,
                    test: function(result) {
                        return result === this.config[0][0].a;
                    }
                });
                syntax('object-nest-array', {
                    dependencies: [
                        'destructuring-declaration-array',
                        'destructuring-declaration-object',
                        'destructuring-declaration-object-double-dot-as'
                    ],
                    config: {
                        {x: [1]}
                    },
                    code: transpile`(function(value) {
                        var {x:[a]} = value;
                        return a;
                    })`,
                    test: function(result) {
                        return result === this.config[0].x[0];
                    }
                });
            });

            group('assignment', function() {
                group('array', function() {
                    syntax('empty', {
                        code: transpile`(function() {
                            [] = [1,2];
                        })`,
                        test: function() {
                            return true;
                        }
                    });
                    syntax('rest-nest', {
                        code: transpile`(function() {
                            var value = [1, 2, 3], first, last;
                            [first, ...[value[2], last]] = value;
                            return [value, first, last];
                        })`,
                        test: function(result) {
                            return (
                                sameValues(result[0], [1, 2, 2]) &&
                                result[1] === 1 &&
                                result[2] === 3
                            );
                        }
                    });
                    syntax('expression-return', {
                        config: [
                            []
                        ],
                        code: transpile`(function(value) {
                            var a;
                            return ([a] = value);
                        })`,
                        test: function(result) {
                            return result === this.config.value;
                        }
                    });
                    syntax('chain', {
                        config: [
                            1
                        ],
                        code: transpile`(function(value) {
                            var a, b;
                            ([a] = [b] = [value]);
                            return [a, b];
                        })`,
                        test: function(result) {
                            return sameValues(result, [this.config[0], this.config[0]]);
                        }
                    });
                });

                group('object', function() {
                    syntax('empty', {
                        code: transpile`(function() {
                            ({} = {a:1, b:2});
                        })`,
                        test: function() {
                            return true;
                        }
                    });
                    syntax('expression-return', {
                        config: [
                            {}
                        ],
                        code: transpile`(function(value) {
                            var a;
                            return ({a} = value);
                        })`,
                        test: function(result) {
                            return result === this.config[0];
                        }
                    });
                    syntax('throw-left-parenthesis', {
                        config: [
                            {}
                        ],
                        when: 'code-compilation-error',
                        code: transpile`(function(value) {
                            var a;
                            ({a}) = value;
                        })`,
                        test: function(result) {
                            return result instanceof SyntaxError;
                        }
                    });
                    syntax('chain', {
                        config: [
                            1
                        ],
                        code: transpile`(function(value) {
                            var a, b;
                            ({a} = {b} = {a: value, b: value});
                            return [a, b];
                        })`,
                        test: function(result) {
                            return sameValues(result, [this.config[0], this.config[0]]);
                        }
                    });
                });
            });

            group('parameters', function() {
                group('array', function() {
                    syntax('arguments', {
                        config: [
                            [10]
                        ],
                        code: transpile`(function(value) {
                            return (function([a]) {
                                return arguments;
                            })(value);
                        })`,
                        test: function(result) {
                            return result[0] === this.config[0];
                        }
                    });
                    syntax('new-function', {
                        config: [
                            [1]
                        ],
                        code: function() {
                            return new Function( // eslint-disable-line no-new-func
                                '[a]',
                                'return a;'
                            )(this.config[0]);
                        },
                        test: function(result) {
                            return result === this.config[0];
                        }
                    });
                    syntax('function-length', {
                        code: transpile`(function() {
                            return function([a]) {};
                        })`,
                        test: function(result) {
                            return result.length === 1;
                        }
                    });
                });

                group('object', function() {
                    syntax('arguments', {
                        config: [
                            {a: 10}
                        ],
                        code: transpile`(function(value) {
                            return (function({a}) {
                                return arguments;
                            })(value);
                        })`,
                        test: function(result) {
                            return result[0] === this.config[0];
                        }
                    });
                    syntax('new-function', {
                        config: [
                            {a: 10}
                        ],
                        code: function() {
                            return new Function( // eslint-disable-line no-new-func
                                '{a}',
                                'return a;'
                            )(this.config[0]);
                        },
                        test: function(result) {
                            return result === this.config[0].a;
                        }
                    });
                    syntax('function-length', {
                        code: transpile`(function() {
                            return function({a}) {};
                        })`,
                        test: function(result) {
                            return result.length === 1;
                        }
                    });
                });
            });
        });

        group('spread', function() {
            group('function-call', function() {
                syntax({
                    config: [
                        Math.max,
                        [1, 2, 3]
                    ],
                    code: transpile`(function(method, args) {
                        return method(...args);
                    })`,
                    test: function(result) {
                        return result === this.config[0].apply(null, this.config[1]);
                    }
                });

                syntax('throw-non-iterable', {
                    config: [
                        Math.max,
                        true
                    ],
                    when: 'code-runtime-error',
                    test: function(error) {
                        return error instanceof Error;
                    }
                });

                syntax('iterable', {
                    dependencies: [
                        'symbol-iterator'
                    ],
                    config: [
                        Math.max,
                        createIterableObject([1, 2, 3])
                    ],
                    test: function(result) {
                        return result === this.config[0].apply(null, [1, 2, 3]);
                    }
                });

                syntax('iterable-instance', {
                    config: [
                        Math.max,
                        Object.create(createIterableObject([1, 2, 3]))
                    ],
                    test: function(result) {
                        return result === this.config[0].apply(null, [1, 2, 3]);
                    }
                });
            });
            group('literal-array', function() {
                syntax({
                    config: [
                        [1, 2, 3]
                    ],
                    code: transpile`(function(value) {
                        return [...value];
                    })`,
                    test: function(result) {
                        return sameValues(result, this.config[0]);
                    }
                });

                syntax('iterable', {
                    dependencies: [
                        'symbol-iterator'
                    ],
                    config: [
                        createIterableObject([1, 2, 3])
                    ],
                    test: function(result) {
                        return sameValues(result, [1, 2, 3]);
                    }
                });

                syntax('iterable-instance', {
                    config: [
                        Object.create(createIterableObject([1, 2, 3]))
                    ],
                    test: function(result) {
                        return sameValues(result, [1, 2, 3]);
                    }
                });
            });
        });

        group('function-prototype-name', function() {
            syntax('statement', {
                code: function() {
                    function foo() {}

                    return [
                        foo,
                        (function() {})
                    ];
                },
                test: function(result) {
                    return (
                        result[0].name === 'foo' &&
                        result[1].name === ''
                    );
                }
            });
            syntax('expression', {
                code: function() {
                    return [
                        (function foo() {}),
                        (function() {})
                    ];
                },
                test: function(result) {
                    return (
                        result[0].name === 'foo' &&
                        result[1].name === ''
                    );
                }
            });
            syntax('new', {
                code: function() {
                    return (new Function()); // eslint-disable-line no-new-func
                },
                test: function(result) {
                    return result.name === 'anonymous';
                }
            });
            syntax('bind', {
                code: function() {
                    function foo() {}

                    return {
                        boundFoo: foo.bind({}),
                        boundAnonymous: (function() {}).bind({}) // eslint-disable-line no-extra-bind
                    };
                },
                test: function(result) {
                    return (
                        result.boundFoo.name === "bound foo" &&
                        result.boundAnonymous.name === "bound "
                    );
                }
            });
            syntax('var', {
                code: function() {
                    var foo = function() {};
                    var bar = function baz() {};

                    return {
                        foo: foo,
                        bar: bar
                    };
                },
                test: function(result) {
                    return (
                        result.foo.name === "foo" &&
                        result.bar.name === "baz"
                    );
                }
            });
            syntax('accessor', {
                code: transpile`(function() {
                    return {
                        get foo() {},
                        set foo(x) {}
                    };
                })`,
                test: function(result) {
                    var descriptor = Object.getOwnPropertyDescriptor(result, 'foo');

                    return (
                        descriptor.get.name === 'get foo' &&
                        descriptor.set.name === 'set foo'
                    );
                }
            });
            syntax('method', {
                code: function() {
                    var o = {
                        foo: function() {},
                        bar: function baz() {}
                    };
                    o.qux = function() {};
                    return o;
                },
                test: function(result) {
                    return (
                        result.foo.name === 'foo' &&
                        result.bar.name === 'baz' &&
                        result.qux.name === ''
                    );
                }
            });
            syntax('method-shorthand', {
                dependencies: [
                    'shorthand-methods'
                ],
                code: transpile`(function() {
                    return {
                        foo() {}
                    };
                })`,
                test: function(result) {
                    return result.foo.name === 'foo';
                }
            });
            syntax('method-shorthand-lexical-binding', {
                config: [
                    1
                ],
                code: transpile`(function(value) {
                    var f = value;
                    return ({
                        f() {
                            return f;
                        }
                    });
                })`,
                test: function(result) {
                    return result.f() === this.config[0];
                }
            });
            syntax('method-computed-symbol', {
                dependencies: [
                    'symbol',
                    'computed-properties'
                ],
                config: function() {
                    return [
                        Symbol("foo"),
                        Symbol()
                    ];
                },
                code: transpile`(function(first, second) {
                    return {
                        [first]: function() {},
                        [second]: function() {}
                    };
                })`,
                test: function(result) {
                    return (
                        result[this.config[0]].name === '[foo]' &&
                        result[this.config[1]].name === ''
                    );
                }
            });
        });

        group('function-default-parameters', function() {
            syntax({
                config: [
                    3
                ],
                code: transpile`(function(value) {
                    function f(a = 1, b = 2) {
                        return {a: a, b: b};
                    }
                    return f.apply(null, arguments);
                })`,
                test: function(result) {
                    return (
                        result.a === this.config[0] &&
                        result.b === 2
                    );
                }
            });
            syntax('explicit-undefined', {
                config: [
                    undefined,
                    3
                ],
                test: function(result) {
                    return (
                        result.a === 1 &&
                        result.b === this.config[1]
                    );
                }
            });
            syntax('refer-previous', {
                code: transpile`(function() {
                    function f(a = 1, b = a) {
                        return {a: a, b: b};
                    }
                    return f.apply(null, arguments);
                })`,
                test: function(result) {
                    return (
                        result.a === this.config[0] &&
                        result.b === this.config[0]
                    );
                }
            });
            syntax('arguments', {
                config: [
                    5,
                    6
                ],
                code: transpile`(function() {
                    function f(a = 1, b = 2, c = 3) {
                        a = 10;
                        return arguments;
                    }
                    return f.apply(null, arguments);
                })`,
                test: function(result) {
                    return sameValues(result, this.config);
                }
            });
            syntax('temporal-dead-zone', {
                code: transpile`(function() {
                    (function(a = a) {}());
                    (function(a = b, b){}());
                })`,
                when: 'code-runtime-error',
                test: function(error) {
                    return error instanceof Error;
                }
            });
            syntax('scope-own', {
                code: transpile`(function() {
                    function fn(a = function() {
                        return typeof b;
                    }) {
                        var b = 1;
                        return a();
                    }
                    return fn();
                })`,
                test: function(result) {
                    return result === 'undefined';
                }
            });
            syntax('new-function', {
                config: [
                    [1, 2],
                    [3]
                ],
                code: function() {
                    return new Function( // eslint-disable-line no-new-func
                        "a = " + this.config[0][0], "b = " + this.config[0][1],
                        "return {a: a, b: b}"
                    ).apply(null, this.config[1]);
                },
                test: function(result) {
                    return (
                        result.a === this.config[1][0] &&
                        result.b === this.config[0][1]
                    );
                }
            });
        });

        group('function-rest-parameters', function() {
            syntax({
                config: [
                    0,
                    1,
                    2
                ],
                code: transpile`(function() {
                    function fn(foo, ...rest) {
                        return {foo: foo, rest: rest};
                    }
                    return fn.apply(null, arguments);
                })`,
                test: function(result) {
                    return (
                        result.rest instanceof Array &&
                        sameValues(result.rest, this.config.slice(1))
                    );
                }
            });
            syntax('throw-setter', {
                code: transpile`(function() {
                    return {
                        set e(...args) {}
                    };
                })`,
                when: 'code-compilation-error',
                test: function(error) {
                    return error instanceof Error;
                }
            });
            syntax('length', {
                code: transpile`(function() {
                    return [
                        function(a, ...b) {},
                        function(...c) {}
                    ];
                })`,
                test: function(result) {
                    return (
                        result[0].length === 1 &&
                        result[1].length === 0
                    );
                }
            });
            syntax('arguments', {
                code: transpile`(function() {
                    function fn(foo, ...rest) {
                        foo = 10;
                        return arguments;
                    }
                    return fn.apply(null, arguments);
                })`,
                test: function(result) {
                    return sameValues(result, this.config);
                }
            });
            syntax('new-function', {
                code: function() {
                    return new Function( // eslint-disable-line no-new-func
                        "a", "...rest",
                        "return {a: a, rest: rest}"
                    ).apply(null, this.config);
                },
                test: function(result) {
                    return (
                        result.a === this.config[0][0] &&
                        sameValues(result.rest, this.config.slice(1))
                    );
                }
            });
        });

        // syntax('spread-function-call-generator', {
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
        //     test: function(result) {
        //         return result === 3;
        //     }
        // });
        // syntax('spread-literal-array-generator', {
        //     args: '\
        //         return {\
        //             value: (function*() {\
        //                 yield 1;\
        //                 yield 2;\
        //                 yield 3;\
        //             }())\
        //         };\
        //     ',
        //     test: function(result) {
        //         return sameValues(result, [1, 2, 3]);
        //     }
        // });
        // syntax('for-of-generator', {
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
        //     test: function(result) {
        //         return result === '123';
        //     }
        // });
        // syntax('destructuring-assignement-generator')
        // https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js#L10247
    });
})();