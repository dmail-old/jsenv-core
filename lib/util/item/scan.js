import util from './util.js';
// import scan from './scan.js';

var ValueGenerator = util.createConstructor({
    constructor() {

    },

    match() {
        return false;
    },

    generate() {
        return undefined;
    }
});

var ValueDefinitionGenerator = util.createConstructor({
    generators: [],

    constructor(valueDefinition) {
        if (arguments.length === 0) {
            throw new Error('ValueGenerator constructor expect one arguments');
        }
        // if (valueDefinition instanceof ValueDefinition === false) {
        //     throw new Error('ValueGenerator constructor first argument must be a valueDefinition instance');
        // }
        this.valueDefinition = valueDefinition;
        this.generator = this.findGenerator(valueDefinition);

        if (!this.generator) {
            throw new Error('no registered generator matched the valueDefinition ' + valueDefinition);
        }
    },

    findGenerator(valueDefinition) {
        var generators = this.generators;
        var i = 0;
        var j = generators.length;
        var generatorFound;

        for (;i < j; i++) {
            var generator = generators[i];
            if (generator.match(valueDefinition)) {
                generatorFound = generator;
                break;
            }
        }

        return generatorFound;
    },

    createValue() {
        return this.generator.create(this.valueDefinition);
    },

    defineProperties(value) {
        var valueDefinition = this.valueDefinition;
        var propertyDefinitions = valueDefinition.propertyDefinitions;
        var i = 0;
        var j = propertyDefinitions.length;

        for (; i < j; i++) {
            var propertyDefinition = propertyDefinitions[i];
            var propertyDefinitionDescriptor = propertyDefinition.descriptor;
            var propertyDescriptor;
            var propertyName = propertyDefinition.name;

            if (propertyDefinitionDescriptor) {
                var propertyDefinitionValueDefinition = propertyDefinition.valueDefinition;
                if (propertyDefinitionValueDefinition) {
                    var propertyValueGenerator = new this.constructor(propertyDefinitionValueDefinition);
                    var propertyValue = propertyDefinitionValueDefinition.value;
                    var generatedPropertyValue = propertyValueGenerator.generate();

                    if (generatedPropertyValue === propertyValue) {
                        propertyDescriptor = propertyDefinitionDescriptor;
                    } else {
                        propertyDescriptor = Object.assign(
                            {},
                            propertyDefinitionDescriptor,
                            {value: generatedPropertyValue}
                        );
                    }
                } else {
                    propertyDescriptor = propertyDefinitionDescriptor;
                }

                Object.defineProperty(value, propertyName, propertyDescriptor);
            }
        }
    },

    defineAttributes(value) {
        var valueDefinition = this.valueDefinition;

        if (valueDefinition.frozenMark) {
            Object.freeze(value);
        } else if (valueDefinition.sealedMark) {
            Object.seal(value);
        } else if (valueDefinition.extensibleMark === false) {
            Object.preventExtensions(value);
        }
    },

    generate() {
        var value = this.createValue();

        // if the created value is not a primitive put properties & attributes on it
        if (util.isPrimitive(value) === false) {
            this.defineProperties(value);
            this.defineAttributes(value);
        }

        return value;
    }
});

(function() {
    var PrototypeGenerator = util.extendConstructor(ValueGenerator, {
        constructor(prototype, generateMethod) {
            ValueGenerator.apply(this, arguments);
            this.prototype = prototype;
            this.prototypeToStringResult = Object.prototype.toString.call(prototype);
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
        match(valueDefinition) {
            var matched = false;

            var valueDefinitionPrototype = valueDefinition.prototype;
            if (valueDefinitionPrototype) {
                var selfPrototype = this.prototype;

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
                } else if (Object.prototype.toString.call(valueDefinitionPrototype) === this.prototypeToStringResult) {
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

        generate(valueDefinition) {
            return Object.create(valueDefinition.prototype);
        }
    });

    var primitiveGenerator = util.extendConstructor(ValueGenerator, {
        match(valueDefinition) {
            return valueDefinition.primitiveMark === true;
        },

        generate(valueDefinition) {
            return valueDefinition.value;
        }
    });

    var arrayGenerator = PrototypeGenerator.create(Array.prototype, function(valueDefinition) {
        return new Array(valueDefinition.value.length);
    });
    var dateGenerator = PrototypeGenerator.create(Date.prototype, function(valueDefinition) {
        return new Date(valueDefinition.value.valueOf());
    });
    // consider function as primitive because creating a function clone involves eval
    // and that would impact performance VERYYYY badly
    // moreover it's not a common practice to set properties on function instance that would have to be unique
    // per object owning the function
    // see http://stackoverflow.com/questions/1833588/javascript-clone-a-function
    var functionGenerator = PrototypeGenerator.create(Function.prototype, function(valueDefinition) {
        return valueDefinition.value;
    });
    var regExpGenerator = PrototypeGenerator.create(RegExp.prototype, function(valueDefinition) {
        return new RegExp(valueDefinition.value.valueOf());
    });
    var objectGenerator = PrototypeGenerator.create(Object.prototype, function(valueDefinition) {
        return Object.create(valueDefinition.prototype);
    });
    ValueDefinitionGenerator.prototype.generators.push(
        primitiveGenerator,
        arrayGenerator,
        dateGenerator,
        functionGenerator,
        regExpGenerator,
        objectGenerator
    );
})();

function industrialize(definition) {
    return definition;
}

export default industrialize;

export const test = {
    modules: ['@node/assert'],

    main() {
        // function createGenerator(valueDefinition) {
        //     return new ValueDefinitionGenerator(valueDefinition);
        // }

        // function generateFrom(...args) {
        //     return createGenerator(concatValueDefinition(...args)).generate();
        // }

        // this.add('Date, RegExp correctly generated', function() {
        //     // how Error object behaves ? does it work?
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

        // this.add('Array correctly generated', function() {
        //     var value = {
        //         list: [true]
        //     };
        //     var generated = generateFrom(value);

        //     assert(generated.list instanceof Array);
        //     assert(generated.list[0] === true);
        //     assert(generated.list !== value.list);
        // });

        // this.add('custom constructor generation', function() {
        //     var constructorCallCount = 0;
        //     var Constructor = function() {
        //         constructorCallCount++;
        //         this.foo = true;
        //     };
        //     var instance = new Constructor();
        //     var value = {
        //         object: instance
        //     };
        //     var generated = generateFrom(value);

        //     assert(generated.object instanceof Constructor);
        //     assert(generated.object.foo === true);
        //     assert(constructorCallCount === 1);
        //     assert(generated.object !== value.object);
        // });

        // this.add('custom prototype generation', function() {
        //     var Prototype = {};
        //     var instance = Object.create(Prototype);
        //     var value = {
        //         object: instance
        //     };
        //     var generated = generateFrom(value);

        //     assert(Prototype.isPrototypeOf(generated.object));
        //     assert(generated.object !== value.object);
        // });

        // this.add('basic concatened generation', function() {
        //     var generated = generateFrom(
        //         {name: 'ok'},
        //         {name: 'boo', age: 10}
        //     );

        //     assert(generated.name === 'boo');
        //     assert(generated.age === 10);
        // });

        // this.add('concatened generation try to use first non primitive as receiver', function() {
        //     var generated = generateFrom(
        //         [],
        //         {foo: true}
        //     );

        //     assert(generated instanceof Array);
        //     assert(generated.foo === true);

        //     generated = generateFrom(
        //         true,
        //         {foo: true}
        //     );

        //     assert(generated instanceof Object);
        //     assert(generated.foo === true);
        // });

        // this.add('nested concatened generation', function() {
        //     var definition = concatValueDefinition(
        //         {item: {foo: true, bar: true}},
        //         {item: {bar: false, bat: true}}
        //     );
        //     var generator = createGenerator(definition);
        //     var generated = generator.generate();

        //     assert(generated.item.foo === true);
        //     assert(generated.item.bar === false);
        //     assert(generated.item.bat === true);

        //     var secondGenerated = generator.generate();
        //     assert(secondGenerated.item !== generated.item);
        //     assert.deepEqual(secondGenerated, generated);
        // });

        // this.add('frozen, sealed, preventExtension is preserved on concatened generation', function() {
        //     var value = {};
        //     Object.freeze(value);
        //     Object.seal(value);
        //     Object.preventExtensions(value);
        //     var generated = generateFrom({name: 'dam'}, value);

        //     assert(Object.isFrozen(generated) === true);
        //     assert(Object.isSealed(generated) === true);
        //     assert(Object.isExtensible(generated) === false);
        // });

        // this.add('writable, enumerable, configurable is preserved on concatened generation', function() {
        //     var dam = {};
        //     Object.defineProperty(dam, 'name', {
        //         writable: true,
        //         enumerable: false,
        //         configurable: true,
        //         value: 'dam'
        //     });
        //     var seb = {};
        //     Object.defineProperty(seb, 'name', {
        //         writable: false,
        //         enumerable: false,
        //         configurable: false,
        //         value: 'seb'
        //     });

        //     var generated = generateFrom(dam, seb);
        //     var descriptor = Object.getOwnPropertyDescriptor(generated, 'name');

        //     assert(descriptor.writable === false);
        //     assert(descriptor.enumerable === false);
        //     assert(descriptor.configurable === false);
        //     assert(descriptor.value === 'seb');
        // });

        // this.add('getter/setter are not called and correctly set on concatened generation', function() {
        //     var getterCalled = false;
        //     var setterCalled = false;
        //     var value = {
        //         get name() {
        //             getterCalled = true;
        //         },

        //         set name(value) {
        //             setterCalled = true;
        //             return value;
        //         }
        //     };
        //     var generated = generateFrom(value);
        //     var descriptor = Object.getOwnPropertyDescriptor(generated, 'name');

        //     assert(getterCalled === false);
        //     assert(setterCalled === false);
        //     assert('set' in descriptor && 'get' in descriptor);
        // });

        // this.add('setter/getter are concatened on concatened generation', function() {
        //     /* eslint-disable */
        //     var generated = generateFrom(
        //         {
        //             get name() {

        //             }
        //         },
        //         {
        //             set name(value) {
        //                 return value;
        //             }
        //         }
        //     );
        //     /* eslint-enable */
        //     var descriptor = Object.getOwnPropertyDescriptor(generated, 'name');
        //     assert('set' in descriptor && 'get' in descriptor);
        // });
    }
};
