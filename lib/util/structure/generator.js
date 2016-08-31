/*

Inspirations :
- http://stackoverflow.com/a/10916838

-> à faire :
que util.createConstructor crée le constructeur si pas passé
et qu'il accepete une chaine comme peremier argument sur le modèle de proto
que StackTrace soit construit avec util.createConstructor
stocker StackTrace d'une erreur dans la propriété trace

Todo :
- generate each value once (also check for support of circular reference)
seems a generator will need to retain a list of already generated value to generate them once
so we'll need a generator object per generation
- check if we really have to set a property.definition when property is a setter/getter
- setter/getter must also be generated just like value is (so they must be referencable)
- allow to specify how function are generated amongst native,wrap,bind,construct
- be able to generate Map & test it
- be able to generate Set & test it
- be able to specify how to generate collection (do we deepClone or keep their content untouched)
- we are not able to generate native Promise as we don't know its internal state but jsenv polyfill we could
- what do we do with DOM nodes?

on thing : if I do something special in an object constructor I'm not able to clone it
because constructor will not be called so
Item = proto.extend({
    id: 0,
    constructor() {
     this.id++;
    }
});
let item = Item.create();
let secondItem = structure.clone(item); // secondItem.id === 1
*/

import util from './util.js';
import Definition from './definition.js';

let Generator = util.createConstructor({
    constructor(definition) {
        this.definition = definition;
    },

    match() {
        return false;
    },

    refine(/* generatedValue, definition */) {

    },

    generate() {
        // let generation = Object.create(this);

        // var references = new util.ReferenceMap();
        var definition = this.definition;
        var value = definition.value;
        var generatedValue = this.produce(definition, value);
        // this.refine(generatedValue, definition);

        // maintenant on va pouvoir générer, on pars de this.generator
        // references.set(value, generatedValue);

        function generateChildren(generator) {
            for (let step of generator.steps) {
                step();
            }
        }
        generateChildren(this);

        return generatedValue;
    }
});

Generator.constructors = [];
Generator.constructors.match = function(definition) {
    var i = 0;
    var j = this.length;
    var matchedConstructor;

    for (;i < j; i++) {
        var Constructor = this[i];
        if (Constructor.prototype.match(definition)) {
            matchedConstructor = Constructor;
            break;
        }
    }

    return matchedConstructor;
};
Generator.register = function(properties) {
    let Constructor = util.extendConstructor(this, properties);
    this.push(Constructor);
    return Constructor;
};
Generator.from = function(definition) {
    if (arguments.length === 0) {
        throw new Error('ValueGenerator constructor expect one arguments');
    }
    if (definition instanceof Definition === false) {
        throw new Error('ValueGenerator constructor first argument must be a valueDefinition instance');
    }

    let MatchingGeneratorConstructor = this.constructors.match(definition);
    if (!MatchingGeneratorConstructor) {
        console.log('cannot find generator constructor for', definition);
        throw new Error('no registered generator constructor matched the valueDefinition ' + definition);
    }

    let generator = new MatchingGeneratorConstructor(definition);
    return generator;
};

(function() {
    function registerGeneratorMatching(match, producer) {
        return Generator.constructors.register({
            match: match,
            produce: producer
        });
    }

    // primitive generator
    registerGeneratorMatching(
        function(definition) {
            return definition.primitiveMark === true;
        },
        function(definition) {
            return definition.value;
        }
    );

    let PrototypeGenerator = util.extendConstructor(Generator, {
        prototypeValue: null,

        constructor(definition) {
            Generator.constructor.call(this, definition);

            this.referenceMap = new util.ReferenceMap();
            this.steps = definition.properties.map(function(property) {
                let propertyName = property.name;
                let propertyDescriptor = {};

                if (property.hasOwnProperty('enumerable')) {
                    propertyDescriptor.enumerable = property.enumerable;
                }
                if (property.hasOwnProperty('configurable')) {
                    propertyDescriptor.configurable = property.configurable;
                }

                let step;
                if (property.hasOwnProperty('valueDefinition')) {
                    if (property.hasOwnProperty('writable')) {
                        propertyDescriptor.writable = property.writable;
                    }
                    let valueGenerator = this.createGeneratorFrom(property.valueDefinition);

                    step = function(generatedValue) {
                        propertyDescriptor.value = valueGenerator.generate();
                        Object.defineProperty(generatedValue, propertyName, propertyDescriptor);
                    };
                } else {
                    let getterGenerator;
                    if (property.hasOwnProperty('getDefinition')) {
                        getterGenerator = this.createGeneratorFrom(property.getDefinition);
                    }
                    let setterGenerator;
                    if (property.hasOwnProperty('setDefinition')) {
                        setterGenerator = this.createGeneratorFrom(property.setDefinition);
                    }

                    step = function(generatedValue) {
                        if (getterGenerator) {
                            propertyDescriptor.get = getterGenerator.generate();
                        }
                        if (setterGenerator) {
                            propertyDescriptor.set = setterGenerator.generate();
                        }

                        Object.defineProperty(generatedValue, propertyName, propertyDescriptor);
                    };
                }

                return step;

                // certain générateurs ne devrait pas être recréer pour les même valeurs
                // donc références on l'a dès ici

                // ceci n'a besoin d'être fait qu'une fois par valeur
                // chaque valeur doit être crée pour pouvoir être set ensuite
                // depending of what we do we may need one value to be generated or maybe one setter & one getter
                // later we may even need many value to be generated for Step which consist into calling a generateValue
                // method
            }, this);

            var propertiesGuard = definition.propertiesGuard;
            if (propertiesGuard === 'frozen') {
                this.steps.push(Object.freeze);
            } else if (propertiesGuard === 'sealed') {
                this.steps.push(Object.seal);
            } else if (propertiesGuard === 'non-extensible') {
                this.steps.push(Object.preventExtensions);
            }
        },

        createGeneratorFrom(definition) {
            // generator are created once BUT they must generate value once per generation
            // but must regenerate value if we call generate again
            // moreover they must support recursivness
            let value = definition.value;
            let existingGenerator = this.referenceMap.get(value);
            let generator;
            if (existingGenerator) {
                generator = existingGenerator;
            } else {
                generator = Generator.from(definition);
                this.referenceMap.set(value, generator);
            }
            return generator;
        },

        match(definition) {
            var matched;
            var definitionPrototypeValue = definition.prototypeValue;
            if (definitionPrototypeValue) {
                // covering most scenarios, leading to some controlled inconsistency
                if (definitionPrototypeValue === this.prototypeValue) {
                    // we first check if prototype are the same
                    // if so we are sure it's the right generator for this valueDefinition
                    matched = true;
                } else {
                    matched = false;
                }
            } else {
                matched = false;
            }

            return matched;
        }
    });

    // toString is not allowed in any case, if some date come from other frames etc
    // we'll provide an utility to recreate the structure into the right format
    // BUT it would require to have it match the toString anyway so cant' we do it right here ?
    // for now let's ignore I don't like it

    // we may want to use this.prototype and not definition.prototype when we matched using Object.prototype.toString
    // so that the generated value use the prototype we are aware of

    // you can fake that value is an array by doing
    // value[Symbol.toStringTag] = 'Array'
    // or
    // value[Symbol.species] = Array;
    // you can hide that value is an array by doing
    // value[Symbol.toStringTag] = 'foo';
    // or
    // value[Symbol.species] = Object
    function registerGeneratorForInstanceOf(constructorOrPrototype, producer) {
        var prototypeValue;
        if (typeof constructorOrPrototype === 'function') {
            prototypeValue = constructorOrPrototype.prototype;
        } else if (typeof constructorOrPrototype === 'object') {
            prototypeValue = constructorOrPrototype;
        }

        return Generator.register.call(PrototypeGenerator, {
            prototypeValue: prototypeValue,
            producer: producer
        });
    }

    // let value = this.generateMethod(definition);
    // this.defineProperties(value, definition);
    // this.defineAttributes(value, definition);

    registerGeneratorForInstanceOf(Array, function(definition) {
        return new Array(definition.value.length);
    });
    registerGeneratorForInstanceOf(Date, function(definition) {
        return new Date(definition.value.valueOf());
    });
    let functionOriginSymbol = typeof Symbol === 'undefined' ? '@@origin' : Symbol();
    registerGeneratorForInstanceOf(Function, function(definition) {
        // https://gist.github.com/dmail/6e639ac50cec8074a346c9e10e76fa65
        // I think we should do something special concerning the prototype property of the function
        // we should also take into account some js env where function.name is not configurable to avoid error
        let fn = definition.value;
        let clonedFn;
        let mode = this.mode || 'primitive';

        // also do not set some unconfigurable property like prototype & name on function

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
            let originFn;

            if (functionOriginSymbol in fn) {
                originFn = fn[functionOriginSymbol];
            } else {
                originFn = fn;
            }

            clonedFn = originFn.bind(definition.parent ? definition.parent.value : undefined);
            clonedFn[functionOriginSymbol] = originFn;

            // definition.getProperty('prototype').inherited = true;
            // clonedFn.prototype = definition.getProperty('prototype').definition.value;
        }

        return clonedFn;
    });

    registerGeneratorForInstanceOf(RegExp, function(definition) {
        return new RegExp(definition.value.valueOf());
    });
    // [
    //     EvalError,
    //     RangeError,
    //     ReferenceError,
    //     SyntaxError,
    //     TypeError,
    //     URIError
    // ].forEach(function(ErrorConstructor) {
    //     let errorGenerator = new PrototypeGenerator(ErrorConstructor.prototype, function(definition) {
    //         var error = new ErrorConstructor();
    //         error.stackTrace = stackTrace.install(definition.value);
    //         return error;
    //     });
    //     errorGenerator.allowToString = false;
    //     addGenerator(errorGenerator);
    // });

    registerGeneratorForInstanceOf(Error, function(definition) {
        /*
        maybe we could do something that would no involve stackTrace to be imported but I do not see what could solve this

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

        pour le moment, les objet error sont considéré comme des primitives
        ce n'en sont bien sur pas mais il n'y a pratiquement aucune valeur ajoutée
        à permettre qu'elle n'en soient pas comparé à l'effort de passé la stack

        même lorsque les erreurs ne seront plus des primitives il faudras que leur propriété trace
        soit héritée par défault un peu comme prototype pour function

        - test generating the same error twice to check if stackTrace is correct
        - test generating a generated error to check how stackTrace behaves (it should be the same as original)
        */

        return definition.value;

        // import stackTrace from 'env/stacktrace';
        // var error = new Error();
        // error.stackTrace = stackTrace.install(definition.value);
        // return error;
    });
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

    // late we will define more generator, this one must always be the last, do something for this
    registerGeneratorForInstanceOf(Object, function(definition) {
        return Object.create(definition.prototypeValue);
    });

    // still missing Map, Set, Blob, etc etc
})();

export default Generator;

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
            return Generator.from(valueDefinition);
        }

        function generateFrom(...args) {
            return createGenerator(defineAll(...args)).generate();
        }

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
        }).skip('error are primitive for now');

        this.add('Function generated with bind', function() {
            // let Item = proto.extend({
            //     method() {

            //     }
            // });
            // // here we expect that method is bound to Item
            // let item = Item.create();
            // // now bound to item
            // let subitem = item.create();
            // // now bound to subitem
            // // so calling subitem.method.call({}) will not call method on {} but on subitem
            // // something which is strange we would loose the ablity to call on something else than Item
            // // Array.prototype.call(arguments) let you do this but we won't allow this
            // // but we could provide somehting like
            // proto.call(Item.method, null);
            // // that would call the original function
            // // moreover original function must remain acessible in some way so that we can rebound the function
            // // because once a function is bound it remains bound forever so we must keep a pointer to the unbound function (the purest form)
            // // for now maybe let's handle function as primitive to simplify stuff

            var fn = function name() {

            };
            fn.foo = true;
            var generatedFn = generateFrom(fn);
            assert(generatedFn.prototype === fn.prototype);
            assert(generatedFn.foo === fn.foo);
            // assert(generatedFn.name === fn.name); // it can be tru only for js engine where Function.prototype.name is configurable
        }).skip('function are primitive for now');

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
