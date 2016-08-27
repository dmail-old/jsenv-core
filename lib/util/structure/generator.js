/*

Inspirations :
- http://stackoverflow.com/a/10916838

As the following demonstrates
var e = new Error();
var b = new Error();
Object.defineProperty(b, 'stack', Object.getOwnPropertyDescriptor(e, 'stack'));
b.stack === e.stack; // false
b.stack = e.stack;
e.stack === b.stack; // true

b !== e but b.stack.getter === e.stack.getter et e.stack.getter va savoir que b !== e
et générer la stack correspondante à l'object erreur sur lequel il est appelé
pour faire en sorte qu'il ai la même stack le mieux serait d'apeller e.stack pour obtenir
la bonne stack qu'on doit ensuite copier sur b.stack
il faut que ça marche avec Error.prepareStackTrace, il y a donc des tests à faire
de sorte que tout ceci fonctionne avec env/stackTrace et remap-error-stack

Todo :
- Faire CV pour job sophia
- test generating the same error twice to check if stackTrace is correct
- test generating a generated error to check how stackTrace behaves (it should be the same as original)
- generate each value once (also check for support of circular reference)
- check if we really have to set a property.definition when property is a setter/getter
- setter/getter must also be generated just like value is (so they must be referencable)
- allow to specify how function are generated amongst native,wrap,bind,construct
- be able to generate Map & test it
- be able to generate Set & test it
- we are not able to generate native Promise as we don't know its internal state but jsenv polyfill we could
- what do we do with DOM nodes?
*/

import stackTrace from 'env/stacktrace';

import util from './util.js';
import Definition from './definition.js';

let DefinitionGenerator = util.createConstructor({
    constructor() {

    },

    match() {
        return false;
    },

    generate() {
        return undefined;
    }
});

let ValueGenerator = util.createConstructor({
    generators: [],

    constructor(definition) {
        if (arguments.length === 0) {
            throw new Error('ValueGenerator constructor expect one arguments');
        }
        if (definition instanceof Definition === false) {
            throw new Error('ValueGenerator constructor first argument must be a valueDefinition instance');
        }
        this.definition = definition;
        this.generator = this.findGenerator(definition);

        if (!this.generator) {
            console.log('cannot find generator for', definition);
            throw new Error('no registered generator matched the valueDefinition ' + definition);
        }
    },

    findGenerator(definition) {
        var generators = this.generators;
        var i = 0;
        var j = generators.length;
        var generatorFound;

        for (;i < j; i++) {
            var generator = generators[i];
            if (generator.match(definition)) {
                generatorFound = generator;
                break;
            }
        }

        return generatorFound;
    },

    generate() {
        return this.generator.generate(this.definition);
    }
});

(function() {
    function addGenerator(generator) {
        ValueGenerator.prototype.generators.push(generator);
    }

    let PrototypeGenerator = util.extendConstructor(DefinitionGenerator, {
        allowToString: true,

        constructor(prototypeValue, generateMethod) {
            DefinitionGenerator.apply(this, arguments);
            this.prototypeValue = prototypeValue;
            this.prototypeToStringResult = Object.prototype.toString.call(prototypeValue);
            this.generateMethod = generateMethod;
        },

        // you can fake that value is an array by doing
        // value[Symbol.toStringTag] = 'Array'
        // or
        // value[Symbol.species] = Array;
        // you can hide that value is an array by doing
        // value[Symbol.toStringTag] = 'foo';
        // or
        // value[Symbol.species] = Object
        match(definition) {
            var matched = false;

            var valueDefinitionPrototype = definition.prototypeValue;
            if (valueDefinitionPrototype) {
                var selfPrototype = this.prototypeValue;

                // covering most scenarios, leading to some controlled inconsistency
                if (valueDefinitionPrototype === selfPrototype) {
                    // we first check if prototype are the same
                    // if so we are sure it's the right generator for this valueDefinition
                    matched = true;
                } else if (selfPrototype.isPrototypeOf(valueDefinitionPrototype)) {
                    // then we allow people to not having to register every prototype
                    // and to set Symbol.species all the time thanks to this check on isPrototypeOf
                    // it means the following works
                    // var foo = {};
                    // var fooGenerator = ValueGenerator.registerPrototype(foo);
                    // var bar = Object.create(foo);
                    // here you dont have to do PrototypeGenerator.registerPrototype(bar) + bar[Symbol.species] = bar;
                    // because foo was registered ValueGenerator will by default match bar
                    // fooGenerator.match(bar); -> returns true
                    matched = true;
                } else if (
                    this.allowToString &&
                    Object.prototype.toString.call(valueDefinitionPrototype) === this.prototypeToStringResult
                ) {
                    // for different frame we have a last resort : Object.prototype.toString
                    // we test if calling Object.prototype.toString gives the same result on both prototypes

                    // inside two frame you write
                    // var foo = {};
                    // var fooGenerator = ValueGenerator.registerPrototype(foo);

                    // then you create a foo instance in a frame
                    // var fooA = Object.create(foo);

                    // and you acess it from an other frame
                    // var fooA = frame.fooA

                    // fooGenerator.match(fooA); // false
                    // if you want it to match you must write in both frames
                    // foo[Symbol.toStringTag] = 'foo';
                    // but this is only supported in chrome as this ggist shows : https://gist.github.com/dmail/c01abe4852230aa629a127f9f63aca23

                    // however this is partially supported for native objects : Array, Object, ...
                    // so this check remains to be able to detect thoose
                    matched = true;
                } else {
                    matched = false;
                }
            } else {
                matched = false;
            }

            return matched;
        },

        // both defineProperties & defineAttributes may be cached for perf
        defineProperties(value, definition) {
            for (let property of definition.properties) {
                let propertyName = property.name;
                let propertyDescriptor = {};

                let propertyGetter = property.getter;
                if (propertyGetter) {
                    propertyDescriptor.get = propertyGetter;
                }
                let propertySetter = property.setter;
                if (propertySetter) {
                    propertyDescriptor.set = propertySetter;
                }
                if (property.hasOwnProperty('writable')) {
                    propertyDescriptor.writable = property.writable;
                }
                if (property.hasOwnProperty('enumerable')) {
                    propertyDescriptor.enumerable = property.enumerable;
                }
                if (property.hasOwnProperty('configurable')) {
                    propertyDescriptor.configurable = property.configurable;
                }
                if (property.hasOwnProperty('definition') && property.definition.hasOwnProperty('value')) {
                    let propertyValueGenerator = new ValueGenerator(property.definition);
                    // let propertyValue = property.definition.value;
                    let generatedPropertyValue = propertyValueGenerator.generate();
                    propertyDescriptor.value = generatedPropertyValue;
                }

                // console.log('set the property', propertyName, propertyDescriptor);
                Object.defineProperty(value, propertyName, propertyDescriptor);
            }
        },

        defineAttributes(value, definition) {
            if (definition.frozenMark) {
                Object.freeze(value);
            } else if (definition.sealedMark) {
                Object.seal(value);
            } else if (definition.extensibleMark === false) {
                Object.preventExtensions(value);
            }
        },

        generate(definition) {
            // we may want to use this.prototype and not definition.prototype when we matched using Object.prototype.toString
            // so that the generated value use the prototype we are aware of
            let value = this.generateMethod(definition);
            this.defineProperties(value, definition);
            this.defineAttributes(value, definition);
            return value;
        }
    });

    let primitiveGenerator = new DefinitionGenerator();
    primitiveGenerator.match = function(definition) {
        return definition.primitiveMark === true;
    };
    primitiveGenerator.generate = function(definition) {
        return definition.value;
    };
    addGenerator(primitiveGenerator);

    let arrayGenerator = new PrototypeGenerator(Array.prototype, function(definition) {
        return new Array(definition.value.length);
    });
    addGenerator(arrayGenerator);
    let dateGenerator = new PrototypeGenerator(Date.prototype, function(definition) {
        let date = new Date(definition.value.valueOf());
        return date;
    });
    addGenerator(dateGenerator);
    let functionGenerator = new PrototypeGenerator(Function.prototype, function(definition, mode = 'bind') {
        // https://gist.github.com/dmail/6e639ac50cec8074a346c9e10e76fa65
        // I think we should do something special concerning the prototype property of the function
        // we should also take into account some js env where function.name is not configurable to avoid error
        let fn = definition.value;
        let clonedFn;

        if (mode === 'primitive') {
            // when in primitive mode we must not define properties & attributes this is currently not possible to prevent
            // this from hapenning but we must allow this (not very complex todo)
            clonedFn = fn;
        } else if (mode === 'construct') {
            clonedFn = new Function('return ' + fn.toString())(); // eslint-disable-line no-new-func
        } else if (mode === 'wrap') {
            let Constructor;
            clonedFn = function() {
                if (this instanceof fn) {
                    if (Constructor === undefined) {
                        Constructor = function(args) {
                            return fn.apply(this, args);
                        };
                        Constructor.prototype = fn.prototype;
                    }
                    return new Constructor(arguments);
                }
                return fn.apply(this, arguments);
            };
        }
        if (mode === 'bind') {
            clonedFn = fn.bind(definition.parent ? definition.parent.value : undefined);
        }

        return clonedFn;
    });
    addGenerator(functionGenerator);
    let regExpGenerator = new PrototypeGenerator(RegExp.prototype, function(definition) {
        return new RegExp(definition.value.valueOf());
    });
    addGenerator(regExpGenerator);
    [
        EvalError,
        RangeError,
        ReferenceError,
        SyntaxError,
        TypeError,
        URIError
    ].forEach(function(ErrorConstructor) {
        let errorGenerator = new PrototypeGenerator(ErrorConstructor.prototype, function(definition) {
            var error = new ErrorConstructor();
            error.stackTrace = stackTrace.install(definition.value);
            return error;
        });
        errorGenerator.allowToString = false;
        addGenerator(errorGenerator);
    });
    let errorGenerator = new PrototypeGenerator(Error.prototype, function(definition) {
        var error = new Error();
        error.stackTrace = stackTrace.install(definition.value);
        return error;
    });
    addGenerator(errorGenerator);
    // disabled because calling custom constructor will call custom code which is not what we want
    // we want a clone
    // let constructorGenerator = new DefinitionGenerator();
    // constructorGenerator.match = function(definition) {
    //     let value = definition.value;
    //     let constructor = value.constructor;
    //     return constructor !== Object && constructor.prototype == value;
    // };
    // constructorGenerator.generate = function(definition) {
    //     return new definition.value.constructor();
    // };

    // still missing Map, Set, Blob, etc etc

    let objectGenerator = new PrototypeGenerator(Object.prototype, function(definition) {
        return Object.create(definition.prototypeValue);
    });
    addGenerator(objectGenerator);
})();

export default ValueGenerator;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        function define(value) {
            return Definition.from(value);
        }

        function defineAll(...args) {
            let definition = define(args[0]);
            args.slice(1).forEach(function(arg) {
                definition.merge(define(arg));
            });
            return definition;
        }

        function createGenerator(valueDefinition) {
            return new ValueGenerator(valueDefinition);
        }

        function generateFrom(...args) {
            return createGenerator(defineAll(...args)).generate();
        }

        // this.add('function are handled as primitive during generation for perf reasons', function() {
        //     var value = {
        //         method() {

        //         }
        //     };
        //     var generated = generateFrom(value);

        //     assert(generated.method === value.method);
        // });

        this.add('Error correcly generated', function() {
            // error object behaves well BUT
            // we have to force generatedError.stackTrace to be error.stackTrace
            // so calling generate on an error already having stackTrace would fail or must be tested at least
            // moreover calling error.toString() only work because stackTrace redefine Error.prototype.toString
            // but doing console.log(error) & console.log(generatedError) will still
            // log the respective error stacks which are the same if you check there properties
            // but apparently the js engine keep somewhere in memory the real stack of the error
            // because the stackTrace will be different

            function assertSameError(error, generatedError) {
                assert(error.constructor === generatedError.constructor);
                assert(error.message === generatedError.message);
                assert(error.toString() === generatedError.toString());
            }

            var error = (function() {
                try {
                    throw new Error('here');
                } catch (e) {
                    return e;
                }
            })();
            var generatedError = generateFrom(error);
            assertSameError(error, generatedError);

            // do the same with referenceError & so on
            var referenceError = (function() {
                try {
                    a; // eslint-disable-line
                } catch (e) {
                    return e;
                }
            })();
            var generatedReferenceError = generateFrom(referenceError);
            assertSameError(referenceError, generatedReferenceError);
        });

        // this.add('Date, RegExp, Error correctly generated', function() {
        //     var value = {
        //         date: new Date(1990, 3, 27),
        //         regExp: /ok/
        //     };
        //     var generated = generateFrom(value);

        //     assert(generated.date.toString() === value.date.toString());
        //     assert(generated.date !== value.date);
        //     assert(generated.regExp.toString() === value.regExp.toString());
        //     assert(generated.regExp !== value.regExp);
        // });
    }
};

// this will be part of structure that will know object tags and be able to serialize/deserialize a given
// structure
// {
//     values: [
//         {tag: 'Object'},
//         1471938451955,
//         {tag: 'Date', constructorArguments: [1]},
//         {tag: 'Object'},
//         'dam',
//         'return true',
//         {tag: 'Function', constructorArguments: [5]};
//         // here object properties are tag, constructorArguments, frozen, sealed, extensible
//     ],
//     properties: [
//         {owner: 0, name: 'foo', value: 4},
//         {owner: 2, name: 'name', getter: 2},
//         {owner: 0, name: 'self', value: 0}
//         // here properties properties are owner, name, value, configurable, writable, enumerable, getter, setter
//     ]
// }

// Structure.prototype.serialize() {
//     JSON.stringify();
// };

// Structure.serialize = function(value) {
//     return Definition.from(value).serialize();
// };

// Structure.unserialize = function(string) {
//     let data = JSON.parse(string);
//     let definition = new Definition();

//     var values = data.values;
//     var properties = data.properties;

//     return definition;
// };
