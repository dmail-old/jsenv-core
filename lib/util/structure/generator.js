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

// https://fr.wikipedia.org/wiki/Industrie_de_transformation
// definition producer & refiner
let Matcher = util.createConstructor({
    constructor() {

    },

    match() {
        return false;
    }
});

// responsible to produce a value
let Recipe = util.createConstructor({
    constructor() {

    },

    produce() {
        return undefined;
    }
});

let RecipeBookEntry = util.createConstructor({
    matcher: null,
    RecipeConstructor: Recipe,

    constructor(matcher, RecipeConstructor) {
        this.matcher = matcher;
        this.RecipeConstructor = RecipeConstructor;
    },

    match(definition) {
        return this.matcher.match(definition);
    },

    recipe(definition) {
        return new this.RecipeConstructor(definition);
    }
});

let RecipeIntent = util.createConstructor({
    constructor() {
        this.referenceMap = new util.ReferenceMap();
    }
});

let RecipeBook = {
    get: function(definition) {
        let entry = this.find(definition);
        return entry.recipe(definition);
        // let recipe;
        // if (referenceMap) {
        //     recipe = referenceMap.get(definition.value);
        // } else {
        //     referenceMap = new util.ReferenceMap();
        // }

        // if (!recipe) {
        //     recipe = entry.recipe(definition);
        //     referenceMap.set(definition.value, recipe);
        // }

        // return recipe;
    },

    find(definition) {
        if (arguments.length === 0) {
            throw new Error('ValueGenerator constructor expect one arguments');
        }
        if (definition instanceof Definition === false) {
            throw new Error('ValueGenerator constructor first argument must be a valueDefinition instance');
        }
        let entry = this.entries.find(function(entry) {
            return entry.match(definition);
        });
        if (!entry) {
            console.log('cannot find recipe for', definition);
            throw new Error('no registered recipe matched the valueDefinition ' + definition);
        }
        return entry;
    },

    register(matcher, RecipeConstructor) {
        let entry = new RecipeBookEntry(matcher, RecipeConstructor);
        this.entries.push(entry);
        return entry;
    },
    recipes: []
};

let ConstructorMatcher = util.extendConstructor(Matcher, {
    constructor(Constructor) {
        this.ConstructorValue = Constructor;
    },
    constructorValue: undefined,
    match(definition) {
        return definition.value instanceof this.ConstructorValue;
    }
});

let primitiveMatcher = new Matcher();
primitiveMatcher.match = function(definition) {
    return definition.primitiveMark === true;
};

let PrimitiveRecipe = util.extendConstructor(Recipe, {
    constructor(definition) {
        this.value = definition.value;
    },

    produce() {
        return this.value;
    }
});

let ObjectRecipe = util.extendConstructor(Recipe, {
    constructor(definition) {
        this.prototypeValue = Object.getPrototypeOf(definition.value);
        // createSetPropertyInstruction() for eevery property
        // createGuardInstruction();
        this.propertiesDefiner = createPropertiesDefiner(definition);
        this.guardDefiner = createGuardDefiner(definition);
    },

    produce() {
        return Object.create(this.prototypeValue);
    },

    productConstructor(product) {
        this.propertiesDefiner.define(product);
        this.guardDefiner.define(product);
    }
});

// function createLazyInstanceProducer(Constructor) {
//     return {
//         ConstructorValue: Constructor,
//         constructor(definition) {
//             this.firstArg = definition.value;
//         },
//         produce() {
//             return new this.ConstructorValue(this.firstArg);
//         }
//     };
// }

function createPropertiesDefiner(definition) {
    // ici on veut kkchose qui va définir toutes les propriétés sur le produit qu'on vient de créer
    var propertiesDefiner = {};

    if (definition.hasOwnProperty('properties')) {
        propertiesDefiner.properties = definition.properties.map(function(property) {
            return compileProperty(property);
        });
    }

    var define = function() {

    };

    propertiesDefiner.define = define;
}

function compileProperty(property) {
    let compiledProperty = {};

    // we must define a new object representing a compiledProperty
    // propertyGenerator.name = property.name;
    var definer = {};
    var descriptor = {};
    var define;
    if (property.hasOwnProperty('enumerable')) {
        descriptor.enumerable = property.enumerable;
    }
    if (property.hasOwnProperty('configurable')) {
        descriptor.configurable = property.configurable;
    }

    if (property.hasOwnProperty('valueDefinition')) {
        if (property.hasOwnProperty('writable')) {
            descriptor.writable = property.writable;
        }
        definer.valueGenerator = compileDefinition(property.valueDefinition);
        define = definePropertyValue;
    } else {
        var hasGetter = property.hasOwnProperty('getDefinition');
        var hasSetter = property.hasOwnProperty('setDefinition');

        if (hasGetter) {
            definer.getterGenerator = compileDefinition(property.getDefinition);
        }
        if (hasSetter) {
            definer.setterGenerator = compileDefinition(property.setDefinition);
        }

        if (hasGetter && hasSetter) {
            define = definePropertyGetterAndSetter;
        } else if (hasGetter) {
            define = definePropertyGetter;
        } else {
            define = definePropertySetter;
        }
    }

    definer.descriptor = descriptor;
    definer.name = property.name;
    definer.define = define;
    compiledProperty.definer = definer;

    return compiledProperty;
}

function definePropertyValue(value) {
    this.descriptor.value = this.valueGenerator.generate();
    Object.defineProperty(value, this.name, this.descriptor);
}

function definePropertyGetter(value) {
    this.descriptor.get = this.getterGenerator.generate();
    Object.defineProperty(value, this.name, this.descriptor);
}

function definePropertySetter(value) {
    this.descriptor.set = this.setterGenerator.generate();
    Object.defineProperty(value, this.name, this.descriptor);
}

function definePropertyGetterAndSetter(value) {
    this.descriptor.get = this.getterGenerator.generate();
    this.descriptor.set = this.setterGenerator.generate();

    Object.defineProperty(value, this.name, this.descriptor);
}

function compileDefinition(definition, referenceMap) {
    let value = definition.value;
    let existingCompiledGenerator = referenceMap.get(value);
    let compiledGenerator;
    if (existingCompiledGenerator) {
        compiledGenerator = existingCompiledGenerator;
    } else {
        compiledGenerator = GeneratorCompiler.compile(definition); // eslint-disable-line
        referenceMap.set(value, compiledGenerator);
    }

    return compiledGenerator;
}

function createGuardDefiner(definition) {
    let definer = {
        define() {}
    };
    let define;
    if (definition.hasOwnProperty('propertiesGuard')) {
        let guard = definition.propertiesGuard;

        if (guard === 'frozen') {
            define = Object.freeze;
        } else if (guard === 'sealed') {
            define = Object.seal;
        } else if (guard === 'non-extensible') {
            define = Object.preventExtensions;
        }
    }
    if (define) {
        definer.define = define;
    }
    return definer;
}

RecipeBook.register(primitiveMatcher, PrimitiveRecipe);
// late we will define more recipe, this one must always be the last, do something for this
RecipeBook.register(new ConstructorMatcher(Object), ObjectRecipe);

// [
//     Error,
//     Function
// ].forEach(function(Constructor) {
//     Factory.register({
//         matcher: createConstructorMatcher(Constructor),
//         producer: createLazyPrimitiveProducer()
//     });
// });

// // produce an instance
// // even if it's discouraged, when someone does new String('yo') it must remain the same
// [
//     Boolean,
//     Number,
//     String,
//     Date,
//     RegExp
// ].forEach(function(Constructor) {
//     Factory.register({
//         matcher: createConstructorMatcher(Constructor),
//         producer: createLazyInstanceProducer(Constructor)
//     });
// });

// // array custom producer
// Factory.register({
//     matcher: createConstructorMatcher(Array),
//     producer: {
//         constructor(definition) {
//             this.length = definition.value.length;
//         },
//         produce() {
//             return new Array(this.length);
//         }
//     }
// });

export default RecipeBook;

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
// function registerGeneratorForInstanceOf(constructorOrPrototype, producer) {
//     var prototypeValue;
//     if (typeof constructorOrPrototype === 'function') {
//         prototypeValue = constructorOrPrototype.prototype;
//     } else if (typeof constructorOrPrototype === 'object') {
//         prototypeValue = constructorOrPrototype;
//     }

//     var Constructor = util.extendConstructor(PrototypeGenerator, {
//         prototypeValue: prototypeValue,
//         producer: producer
//     });

//     Generator.constructors.push(Constructor);
// }

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

// export const test = {
//     modules: ['@node/assert'],

//     main(assert) {
//         function define(value) {
//             return Definition.from(value);
//         }

//         function defineAll(...args) {
//             let definition = define(args[0]);
//             args.slice(1).forEach(function(arg) {
//                 definition.merge(define(arg));
//             });
//             return definition;
//         }

//         function createGenerator(valueDefinition) {
//             return Generator.from(valueDefinition);
//         }

//         function generateFrom(...args) {
//             return createGenerator(defineAll(...args)).generate();
//         }

//         this.add('Error correcly generated', function() {
//             // error object behaves well BUT
//             // we have to force generatedError.stackTrace to be error.stackTrace
//             // so calling generate on an error already having stackTrace would fail or must be tested at least
//             // moreover calling error.toString() only work because stackTrace redefine Error.prototype.toString
//             // but doing console.log(error) & console.log(generatedError) will still
//             // log the respective error stacks which are the same if you check there properties
//             // but apparently the js engine keep somewhere in memory the real stack of the error
//             // because the stackTrace will be different

//             function assertSameError(error, generatedError) {
//                 assert(error.constructor === generatedError.constructor);
//                 assert(error.message === generatedError.message);
//                 assert(error.toString() === generatedError.toString());
//             }

//             var error = (function() {
//                 try {
//                     throw new Error('here');
//                 } catch (e) {
//                     return e;
//                 }
//             })();
//             var generatedError = generateFrom(error);
//             assertSameError(error, generatedError);

//             // do the same with referenceError & so on
//             var referenceError = (function() {
//                 try {
//                     a; // eslint-disable-line
//                 } catch (e) {
//                     return e;
//                 }
//             })();
//             var generatedReferenceError = generateFrom(referenceError);
//             assertSameError(referenceError, generatedReferenceError);
//         }).skip('error are primitive for now');

//         this.add('Function generated with bind', function() {
//             // let Item = proto.extend({
//             //     method() {

//             //     }
//             // });
//             // // here we expect that method is bound to Item
//             // let item = Item.create();
//             // // now bound to item
//             // let subitem = item.create();
//             // // now bound to subitem
//             // // so calling subitem.method.call({}) will not call method on {} but on subitem
//             // // something which is strange we would loose the ablity to call on something else than Item
//             // // Array.prototype.call(arguments) let you do this but we won't allow this
//             // // but we could provide somehting like
//             // proto.call(Item.method, null);
//             // // that would call the original function
//             // // moreover original function must remain acessible in some way so that we can rebound the function
//             // // because once a function is bound it remains bound forever so we must keep a pointer to the unbound function (the purest form)
//             // // for now maybe let's handle function as primitive to simplify stuff

//             var fn = function name() {

//             };
//             fn.foo = true;
//             var generatedFn = generateFrom(fn);
//             assert(generatedFn.prototype === fn.prototype);
//             assert(generatedFn.foo === fn.foo);
//             // assert(generatedFn.name === fn.name); // it can be tru only for js engine where Function.prototype.name is configurable
//         }).skip('function are primitive for now');

//         // this.add('Date, RegExp, Error correctly generated', function() {
//         //     var value = {
//         //         date: new Date(1990, 3, 27),
//         //         regExp: /ok/
//         //     };
//         //     var generated = generateFrom(value);

//         //     assert(generated.date.toString() === value.date.toString());
//         //     assert(generated.date !== value.date);
//         //     assert(generated.regExp.toString() === value.regExp.toString());
//         //     assert(generated.regExp !== value.regExp);
//         // });
//     }
// };

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
