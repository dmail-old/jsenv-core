import '/array/prototype/symbol/iterator/test.js';
import '/object/get-prototype-of/test.js';
import '/object/create/test.js';
import '/shorthand-notation/test.js';
import '/computed-properties/test.js';

import {expect, transpile, sameValues, createIterableObject} from '/test-helpers.js';

const test = expect({
    'compiles': transpile`(function * generator(value) {
        yield value;
    })`,
    'runs'(generatorFn) {
        var value = 1;
        var iterator = generatorFn(value);
        return sameValues(iterator, [value]);
    },
    'prototype chain'(generatorFn) {
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
    'prototype chain iterability'(generatorFn) {
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
    },
    'expression': expect({
        'compiles': transpile`(function(value) {
            var generator = function * () {
                yield value;
            };
            return generator;
        })`,
        'runs'(fn) {
            var value = 1;
            var generatorFn = fn(value);
            var iterator = generatorFn(value);
            return sameValues(iterator, [value]);
        }
    }),
    'returns': expect({
        'compiles': transpile`(function * generator() {
            yield 1;
            yield 2;
        })`,
        'runs'(generatorFn) {
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
    }),
    // does not seems to work with babel
    // 'sending': expect({
    //     'compiles': transpile`(function(value) {
    //         var sent;
    //         function * generator() {
    //             sent = [yield value];
    //         }
    //         return [
    //             generator(),
    //             sent
    //         ];
    //     })`,
    //     'runs'(fn) {
    //         var value = 4;
    //         var result = fn(value);
    //         var iterator = result[0];
    //         var sent = result[1];
    //         console.log('sent is', sent);
    //         return (
    //             sameValues(iterator, [value]) &&
    //             sameValues(sent, [value])
    //         );
    //     }
    // }),
    'shorthand-notation': expect({
        'compiles': transpile`(function(value) {
            return {
                * generator() {
                    yield value;
                }
            };
        })`,
        'runs'(fn) {
            var value = 1;
            var result = fn(value);
            var generator = result.generator();
            return sameValues(generator, [value]);
        },
        'computed': expect({
            'compiles': transpile`(function(name, value) {
                return {
                    * [name]() {
                        yield value;
                    }
                };
            })`,
            'runs'(fn) {
                var name = 'foo';
                var value = 1;
                var result = fn(name, value);
                var generator = result[name]();
                return sameValues(generator, [value]);
            }
        }),
        'key-string': expect({
            'compiles': transpile`(function(value) {
                return {
                    * "foo bar"() {
                        yield value;
                    }
                };
            })`,
            'runs'(fn) {
                var value = 1;
                var result = fn(value);
                var generator = result['foo bar']();
                return sameValues(generator, [value]);
            }
        })
    }),
    'this': expect({
        'compiles': transpile`(function * generator(value) {
            yield this.value;
        })`,
        'runs'(generatorFn) {
            var value = 1;
            var object = {value: value};
            var iterator = generatorFn.call(object);
            return sameValues(iterator, [value]);
        }
        // babel does not support this
        // 'throw when called with new': expectThrow(generatorFn => {
        //     new generatorFn(); // eslint-disable-line no-new,new-cap
        // })
    }),
    // I don't get this one, it's commented for now
    // 'iterator throw method makes yield throw': expect({
    //     'compiles': transpile`(function * generator(spy) {
    //         try {
    //             yield 1;
    //             yield 2;
    //         } catch (e) {
    //             spy.throwedValue = e;
    //         }
    //     })`,
    //     'runs': expectThrow(generatorFn => {
    //         var spy = {};
    //         var value = 10;
    //         var iterator = generatorFn(spy);

    //         iterator.throw(value);
    //         console.log('the spy', spy);
    //         return spy.throwedValue === value;
    //     })
    // }),
    'yield': expect({
        'priority': expect({
            'compiles': transpile`(function * generator(spy) {
                spy.value = yield 0 ? true : false;
            })`,
            'runs'(generatorFn) {
                var spy = {};
                var generator = generatorFn(spy);
                generator.next();
                generator.next(true);
                return spy.value === true;
            }
        }),
        'star': expect({
            'compiles': transpile`(function * generator(value) {
                yield * value;
            })`,
            'works with iterable'(generatorFn) {
                var data = [1, 2];
                var iterable = createIterableObject(data);
                var generator = generatorFn(iterable);
                var instanceGenerator = generatorFn(Object.create(iterable));

                return (
                    sameValues(generator, data) &&
                    sameValues(instanceGenerator, data)
                );
            },
            // babel does not support this
            // 'throw when value is non iterable': expectThrow(generatorFn => {
            //     generatorFn(true);
            // }),
            'iterator return is called when generator returns': expect({
                'compiles': transpile`(function * generator(value, spy) {
                    try {
                        yield *value;
                    } finally {
                        spy.callOrder += 'closing';
                    }
                })`,
                'runs'(generatorFn) {
                    var spy = {
                        callOrder: ''
                    };
                    var iterable = createIterableObject([1], {
                        'return': function() {
                            spy.callOrder += 'return';
                            return {done: true};
                        }
                    });
                    var generator = generatorFn(iterable, spy);
                    generator.next();
                    generator['return'](); // eslint-disable-line dot-notation
                    return spy.callOrder === 'returnclosing';
                }
            }),
            'iterator return is called when generator throw': expect({
                'compiles': transpile`(function * generator(value) {
                    try {
                        yield *value;
                    } catch(e) {

                    }
                })`,
                'runs'(generatorFn) {
                    var closed = false;
                    var iterable = createIterableObject([1], {
                        'throw': undefined,
                        'return': function() {
                            closed = true;
                            return {done: true};
                        }
                    });
                    var generator = generatorFn(iterable);
                    generator.next();
                    generator['throw'](); // eslint-disable-line dot-notation
                    return closed;
                }
            })
        })
    })
});

export default test;
