import '/symbol/iterator/test.js';
import '/object/get-prototype-of/test.js';

import {transpile, sameValues, every, createIterableObject, expectThrow} from '/test-helpers.js';

const test = {
    run: transpile`(function * generator(value) {
        yield value;
    })`,
    complete: every(
        function(generatorFn) {
            var value = 1;
            var iterator = generatorFn(value);
            return sameValues(iterator, [value]);
        },
        function(generatorFn) {
            var generator = generatorFn();
            var ownProto = Object.getPrototypeOf(generator);
            var sharedProto = Object.getPrototypeOf(ownProto);

            return (
                ownProto === generatorFn.prototype &&
                sharedProto !== Object.prototype &&
                sharedProto === Object.getPrototypeOf(generatorFn.prototype) &&
                sharedProto.hasOwnProperty('next')
            );
        },
        function(generatorFn) {
            var generator = generatorFn();
            var ownProto = Object.getPrototypeOf(generator);
            var sharedProto = Object.getPrototypeOf(ownProto);
            var ancestorProto = Object.getPrototypeOf(sharedProto);

            return (
                ancestorProto.hasOwnProperty(Symbol.iterator) &&
                sharedProto.hasOwnProperty(Symbol.iterator) === false &&
                ownProto.hasOwnProperty(Symbol.iterator) === false &&
                generator[Symbol.iterator]() === generator
            );
        }
    ),
    children: [
        {
            name: 'expression',
            run: transpile`(function(value) {
                var generator = function * () {
                    yield value;
                };
                return generator;
            })`,
            complete(fn) {
                var value = 1;
                var iterator = fn(value);
                return sameValues(iterator, [value]);
            }
        },
        {
            name: 'return',
            run: transpile`(function * generator() {
                yield 1;
                yield 2;
            })`,
            complete(generatorFn) {
                var generator = generatorFn();
                var value = 10;
                generator.next();
                var entry = generator.return(value);
                var lastEntry = generator.next();
                return (
                    entry.done === true &&
                    entry.value === value &&
                    lastEntry.done === true &&
                    lastEntry.value === undefined
                );
            }
        },
        {
            name: 'sending',
            run: transpile`(function(value) {
                var sent;
                function * generator() {
                    sent = [yield value];
                }
                return [
                    generator(),
                    sent
                ];
            })`,
            complete(fn) {
                var value = 1;
                var result = fn(value);
                var iterator = result[0];
                var sent = result[1];
                return (
                    sameValues(iterator, [value]) &&
                    sameValues(sent, [value])
                );
            }
        },
        {
            name: 'shorthand-notation',
            run: transpile`(function(value) {
                return {
                    * generator() {
                        yield value;
                    }
                };
            })`,
            complete(fn) {
                var value = 1;
                var result = fn(value);
                var generator = result.generator();
                return sameValues(generator, [value]);
            },
            children: [
                {
                    name: 'computed',
                    run: transpile`(function(name, value) {
                        return {
                            * [name]() {
                                yield value;
                            }
                        };
                    })`,
                    complete(fn) {
                        var name = 'foo';
                        var value = 1;
                        var result = fn(name, value);
                        var generator = result[name]();
                        return sameValues(generator, [value]);
                    }
                },
                {
                    name: 'key-string',
                    run: transpile`(function(value) {
                        return {
                            * "foo bar"() {
                                yield value;
                            }
                        };
                    })`,
                    complete(fn) {
                        var value = 1;
                        var result = fn(value);
                        var generator = result['foo bar']();
                        return sameValues(generator, [value]);
                    }
                }
            ]
        },
        {
            name: 'this',
            run: transpile`(function * generator(value) {
                yield this.value;
            })`,
            complete: every(
                function(fn) {
                    var value = 1;
                    var object = {value: value};
                    var iterator = fn.call(object);
                    return sameValues(iterator, [value]);
                },
                expectThrow(function(fn) {
                    new fn(); // eslint-disable-line no-new,new-cap
                })
            )
        },
        {
            name: 'throw',
            run: transpile`(function * generator(spy) {
                try {
                    yield 1;
                    yield 2;
                } catch (e) {
                    spy.throwedValue = e;
                }
            })`,
            complete(generatorFn) {
                var spy = {};
                var value = 10;
                var iterator = generatorFn(spy);
                iterator.throw(value);
                return spy.throwedValue === value;
            }
        },
        {
            name: 'yield',
            children: [
                {
                    name: 'priority',
                    run: transpile`(function * generator(spy) {
                        spy.value = yield 0 ? true : false;
                    })`,
                    complete(generatorFn) {
                        var spy = {};
                        var generator = generatorFn(spy);
                        generator.next();
                        generator.next(true);
                        return spy.value === true;
                    }
                },
                {
                    name: 'star',
                    run: transpile`(function * generator(value) {
                        yield * value;
                    })`,
                    complete: every(
                        function(generatorFn) {
                            var data = [1, 2];
                            var iterable = createIterableObject(data);
                            var generator = generatorFn(iterable);
                            var instanceGenerator = generatorFn(Object.create(iterable));

                            return (
                                sameValues(generator, data) &&
                                sameValues(instanceGenerator, data)
                            );
                        },
                        expectThrow(function(generatorFn) {
                            generatorFn(true);
                        })
                    ),
                    children: [
                        {
                            name: 'return-called-by-generator-return',
                            run: transpile`(function * generator(value, spy) {
                                try {
                                    yield *value;
                                } finally {
                                    spy.callOrder = 'closing';
                                }
                            })`,
                            complete(fn) {
                                var spy = {
                                    callOrder: ''
                                };
                                var iterable = createIterableObject([1], {
                                    'return': function() {
                                        spy.callOrder += 'return';
                                        return {done: true};
                                    }
                                });
                                var generator = fn(iterable, spy);
                                generator.next();
                                generator['return'](); // eslint-disable-line dot-notation
                                return spy.callOrder === 'return closing';
                            }
                        },
                        {
                            name: 'return-called-by-generator-throw',
                            run: transpile`(function * generator(value) {
                                try {
                                    yield *value;
                                } catch(e) {

                                }
                            })`,
                            complete(fn) {
                                var closed = false;
                                var iterable = createIterableObject([1], {
                                    'throw': undefined,
                                    'return': function() {
                                        closed = true;
                                        return {done: true};
                                    }
                                });
                                var generator = fn(iterable);
                                generator.next();
                                generator['throw'](); // eslint-disable-line dot-notation
                                return closed;
                            }
                        }
                    ]
                }
            ]
        }
    ]
};

export default test;
