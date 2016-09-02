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
- setter/getter must also be generated just like value is (so they must be referencable)
- allow to specify how function are generated amongst native,wrap,bind,construct
- be able to generate Map & test it
- be able to generate Set & test it
- be able to specify how to generate collection (do we deepClone or keep their content untouched)
- what do we do with DOM nodes?
- do something like structure.scanExternal() that will get an external value (coming from a frame)
and return a definition for that value, as if the value was imported from something external (Array will be instanceof global.Array)

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

// we must first think generator without definition
// we'll just use definition to create the generator we want
// but generator will not know the definition who created it
// so we basically a structure similar to definition

let Property = util.createConstructor({
    constructor(generator) {
        this.generator = generator;
    },

    populate(property) {
        // certain générateurs ne devrait pas être recréer pour les même valeurs
        // donc références on l'a dès ici

        // ceci n'a besoin d'être fait qu'une fois par valeur
        // chaque valeur doit être crée pour pouvoir être set ensuite
        // depending of what we do we may need one value to be generated or maybe one setter & one getter
        // later we may even need many value to be generated for Step which consist into calling a generateValue
        // method

        this.name = property.name;

        if (property.reference) {
            // l'assignation doit être la même que pour l'assignation de référence, sans regénérer une valeur
            this.assign = function() {

            };
        } else if (property.privateMark) {
            this.assign = function(value) {
                // how to assign private property will be relative to object
                return value;
            };
        } else {
            this.descriptor = {};

            if (property.hasOwnProperty('enumerable')) {
                this.descriptor.enumerable = property.enumerable;
            }
            if (property.hasOwnProperty('configurable')) {
                this.descriptor.configurable = property.configurable;
            }

            if (property.hasOwnProperty('valueDefinition')) {
                if (property.hasOwnProperty('writable')) {
                    this.descriptor.writable = property.writable;
                }
                this.valueGenerator = this.createGeneratorFrom(property.valueDefinition, referenceMap);
                this.assign = this.assignValue;
            } else {
                if (property.hasOwnProperty('getDefinition')) {
                    this.getterGenerator = this.createGeneratorFrom(property.getDefinition, referenceMap);
                }
                if (property.hasOwnProperty('setDefinition')) {
                    this.setterGenerator = this.createGeneratorFrom(property.setDefinition, referenceMap);
                }
                this.assign = this.assignSetterAndOrGetter;
            }
        }
    },

    createGeneratorFrom(definition, referenceMap) {
        // generator are created once BUT they must generate value once per generation
        // but must regenerate value if we call generate again
        // moreover they must support recursivness
        let value = definition.value;
        let existingGenerator = referenceMap.get(value);
        let generator;
        if (existingGenerator) {
            generator = existingGenerator;
        } else {
            generator = Generator.from(definition); // we MUST pass referenceMap so that propertyAssignment of this generator
            // do not duplicate generators
            // maybe I should do something clever inside definition :
            // instead of having properties belonging to a definition
            // we would have flat list of property for a given definition
            // but that list of property may be related to any definition not only to the definition itself
            // ce serais pratique mais comme le montre markAsUnreachable() on a besoin d'avoir cette logique en arbre
            // mais je me demande si ce ne serais pa splus efficace de l'avoir à plat -> non je pense pas
            referenceMap.set(value, generator);
        }
        return generator;
    },

    assignValue(value) {
        this.descriptor.value = this.valueGenerator.generate();
        Object.defineProperty(value, this.name, this.descriptor);
    },

    assignSetterAndOrGetter(value) {
        var getterGenerator = this.getterGenerator;
        if (getterGenerator) {
            this.descriptor.get = getterGenerator.generate();
        }
        var setterGenerator = this.setterGenerator;
        if (setterGenerator) {
            this.descriptor.set = setterGenerator.generate();
        }
        Object.defineProperty(value, this.name, this.descriptor);
    }
});

let Generator = util.createConstructor({
    value: undefined,
    properties: [],
    privatePorperties: [],
    parent: null,
    // produceOptions: {},

    constructor(parent) {
        if (parent) {
            this.parent = parent;
            this.referenceMap = this.parent.referenceMap;
        } else {
            this.parent = null;
            this.referenceMap = new util.ReferenceMap();
        }
    },

    setValue(value) {
        this.value = value;
    },

    createGenerator() {

    },

    createProperty(data) {
        let property = new Property();

        property.name = data.name;
        property.generator = this.createGenerator(property.valueDefinition);
    },

    setProperties(properties) {
        this.properties = properties.map(function(property) {

        }, this);
    },

    transform(producedValue) {
        return producedValue;
    },

    generate(definition) {
        var references = new util.ReferenceMap();
        var producedValue = this.produce(definition);

        references.set(definition.value, producedValue);

        return this.transform(producedValue, references);
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
Generator.register = function(match, Constructor) {
    Constructor.prototype.match = match;
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

// l'idée c'est de créer une nouvelle version de l'arbre definition
// une sorte de version compilé de la définition qui permet de générer une valeur
// je dirais donc generatorTree, et donc ce generator tree y'en a qu'un par generator mais y'a besoin de le faire
// et par contre à chaque fois qu'on génère une valeur faudrais qu'on sache ou est la valeur existant s'il y en a une pour ne pas générer deux fois
// ça on peut s'en sortir avec les références
// ok j'ai le concept faudra faire ça
// let GeneratorTree = util.createConstructor({
//     constructor(rootGenerator) {
//         this.referenceMap = new util.ReferenceMap();
//         this.rootGenerator = rootGenerator;
//     }
// });

let PrototypeGenerator = util.extendConstructor(Generator, {
    prototypeValue: null,

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
    },

    constructor(definition) {
        Generator.constructor.call(this, definition);

        // c'est ici que l'idée serais d'utiliser referenceMap pour éviter de recrée des générateurs
        // mais a-t-on besoin de recréer une referenceMap sachant qu'on a l'info dans definition.reference?

        var referenceMap = new util.ReferenceMap();
        this.properties = definition.properties.map(function(property) {
            return new PropertyAssignment(property, referenceMap);
        }, this);

        // once the value is generated we'll have to do something more about it
        var propertiesGuard = definition.propertiesGuard;
        if (propertiesGuard === 'frozen') {
            this.refine = Object.freeze;
        } else if (propertiesGuard === 'sealed') {
            this.refine = Object.seal;
        } else if (propertiesGuard === 'non-extensible') {
            this.refine = Object.preventExtensions;
        }
    },

    transform(producedValue) {
        // set every property
        for (let property of this.properties) {
            property.set(producedValue);
        }
        // ici il faut aussi freeze/seal/guard
        return producedValue;
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

function producePrimitive(definition) {
    return definition.value;
}

function produceInstance(definition) {
    return new this.prototypeValue.constructor(definition.value);
}

function producePrototype(definition) {
    return Object.create(definition.prototypeValue);
}

function registerGeneratorMatching(match, producer) {
    var Constructor = util.extendConstructor(Generator, {
        produce: producer
    });

    return Generator.register(match, Constructor);
}

// even if it's discouraged, when someone does new String('yo') it should remain the same
// so we should register all of them String, Number, Boolean

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

    var Constructor = util.extendConstructor(PrototypeGenerator, {
        prototypeValue: prototypeValue,
        producer: producer
    });

    Generator.constructors.push(Constructor);
}

// primitive generator
registerGeneratorMatching(function(definition) {
    return definition.primitiveMark === true;
}, producePrimitive);
// array is specific
registerGeneratorForInstanceOf(Array, function(definition) {
    return new Array(definition.value.length);
});
// something created using new Boolean must be generated the same way
registerGeneratorForInstanceOf(Boolean, produceInstance);
registerGeneratorForInstanceOf(Number, produceInstance);
registerGeneratorForInstanceOf(String, produceInstance);
registerGeneratorForInstanceOf(Date, produceInstance);
registerGeneratorForInstanceOf(Error, producePrimitive);
registerGeneratorForInstanceOf(Function, producePrimitive);
registerGeneratorForInstanceOf(RegExp, produceInstance);
// late we will define more generator, this one must always be the last, do something for this
registerGeneratorForInstanceOf(Object, producePrototype);

// about Function
// let functionOriginSymbol = typeof Symbol === 'undefined' ? '@@origin' : Symbol();
// // https://gist.github.com/dmail/6e639ac50cec8074a346c9e10e76fa65
// // I think we should do something special concerning the prototype property of the function
// // we should also take into account some js env where function.name is not configurable to avoid error
// let fn = definition.value;
// let clonedFn;
// let mode = this.mode || 'primitive';

// // also do not set some unconfigurable property like prototype & name on function

// if (mode === 'primitive') {
//     // when in primitive mode we must not define properties & attributes this is currently not possible to prevent
//     // this from hapenning but we must allow this (not very complex todo)
//     clonedFn = fn;
// } else if (mode === 'construct') {
//     clonedFn = new Function('return ' + fn.toString())(); // eslint-disable-line no-new-func
// } else if (mode === 'wrap') {
//     let Constructor;
//     clonedFn = function() {
//         if (this instanceof fn) {
//             if (Constructor === undefined) {
//                 Constructor = function(args) {
//                     return fn.apply(this, args);
//                 };
//                 Constructor.prototype = fn.prototype;
//             }
//             return new Constructor(arguments);
//         }
//         return fn.apply(this, arguments);
//     };
// }
// if (mode === 'bind') {
//     let originFn;

//     if (functionOriginSymbol in fn) {
//         originFn = fn[functionOriginSymbol];
//     } else {
//         originFn = fn;
//     }

//     clonedFn = originFn.bind(definition.parent ? definition.parent.value : undefined);
//     clonedFn[functionOriginSymbol] = originFn;

//     // definition.getProperty('prototype').inherited = true;
//     // clonedFn.prototype = definition.getProperty('prototype').definition.value;
// }
// return clonedFn;

// about Error
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

// return definition.value;
// still missing Map, Set, Blob, etc etc

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
