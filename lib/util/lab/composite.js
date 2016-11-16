/* eslint-disable no-use-before-define */

import {Lab, Element} from './lab.js';
import {PrimitiveProperties} from './primitive.js';
import {
    CopyTransformation,
    // CloneTransformation,
    Reaction,
    PrevailReaction,
    createDynamicReaction
} from './transformation.js';

function createConstructedByProperties(Constructor) {
    // const CombineElementReaction = CombineObjectReaction.extend({
    //     produceComposite(firstValue, secondValue) {
    //         return new Constructor(secondValue);
    //     }
    // });

    return {
        match(value) {
            return Constructor.prototype.isPrototypeOf(value);
        },

        generate(value) {
            return new Constructor(value.valueOf());
        }
    };
}

const ObjectElement = Element.extend('Object', createConstructedByProperties(Object), {
    generate() {
        return {};
    },

    combine() {
        return {};
    },

    copy() {
        const copy = this.createConstructor(this.value);
        return copy;
    },

    clone() {
        const clone = this.createConstructor(this.generate());
        return clone;
    },

    fill(value) {
        Object.freeze(value); // i'm not sure array should be frozen or not
        Object.getOwnPropertyNames(value).forEach(function(name) {
            this.readProperty(value, name);
        }, this);
    },

    readProperty(value, name) {
        const propertyNode = this.createProperty(name);
        this.addProperty(propertyNode);

        const descriptor = Object.getOwnPropertyDescriptor(value, name);
        if (descriptor === null || descriptor === undefined) {
            throw new Error('value has no property named ' + name + ' (value : ' + value + ' )');
        }
        propertyNode.fill(descriptor);

        return propertyNode;
    },

    createProperty(name) {
        return ObjectPropertyElement.create(name);
    },

    addProperty(property) {
        return this.appendChild(property);
    },

    hasProperty(name) {
        return this.children.some(function(property) {
            return property.name === name;
        });
    },

    getProperty(name) {
        return this.children.find(function(property) {
            return property.name === name;
        });
    },

    compile() {
        // will be used by construct
        const instance = Object.create(this.value);

        // for (let property of this) {
            // set every property that requires to be on instance
        // }

        return instance;
    },

    construct() {
        const instance = this.compile();

        // call every constructor on instance

        return instance;
    }
});
const CombineObjectReaction = Reaction.extend({
    produce(firstObject, secondObject) {
        const firstValue = firstObject.value;
        const secondValue = secondObject.value;
        const combinedValue = firstObject.combine(firstValue, secondValue);
        const compositeObject = firstObject.createConstructor(combinedValue);

        return compositeObject;
    },

    refine(compositeObject, firstComponent, secondComponent) {
        const unhandledSecondProperties = secondComponent.children.slice();
        for (let property of firstComponent) {
            const secondPropertyIndex = unhandledSecondProperties.findIndex(function(secondProperty) {
                return secondProperty.name === property.name;
            });
            if (secondPropertyIndex === -1) {
                this.handleNewProperty(compositeObject, property);
                // console.log('add new property', property.value);
            } else {
               // handle the conflict and remove this property from secondProperties
                const conflictualProperty = unhandledSecondProperties[secondPropertyIndex];
                unhandledSecondProperties.splice(secondPropertyIndex, 1);
                this.handlePropertyCollision(compositeObject, property, conflictualProperty);
                // console.log('add conflictual property', property.value, conflictualProperty.value);
            }
        }

        for (let property of unhandledSecondProperties) {
            this.handleNewProperty(compositeObject, property);
            // console.log('add new second property', property.value);
        }

        Object.freeze(compositeObject.value);
    },

    handlePropertyCollision(compositeObject, property, conflictualProperty) {
        // here we could impvoe perf by finding the appropriat reaction and if the reaction
        // is to clone currentProperty we can do nothing because it's already there
        const reaction = property.reactWith(conflictualProperty, compositeObject);
        const importedProperty = reaction.prepare();
        reaction.insert();
        reaction.proceed();
        this.defineProperty(compositeObject, importedProperty);
        return importedProperty;
    },

    handleNewProperty(compositeObject, property) {
        const transformation = property.transform(compositeObject);
        const importedProperty = transformation.prepare();
        transformation.insert();
        transformation.proceed();
        this.defineProperty(compositeObject, importedProperty);
        return importedProperty;
    },

    defineProperty(compositeObject, property) {
        // maybe only if the property is configurable but that's not the point
        // a non configurable property can be added as long as there is not already an unconfigurable property
        // but some object have native non configurable properties (length for Array & name for function)
        Object.defineProperty(compositeObject.value, property.name, property.descriptor);
    },

    addProperty(compositeObject, property) {
        compositeObject.appendChild(property);
    }
});
ObjectElement.refine({
    transformation: CopyTransformation,
    reaction: CombineObjectReaction
});
const ObjectPropertyElement = Element.extend('ObjectProperty', {
    combine(firstPropertyName, secondPropertyName) {
        return secondPropertyName;
    },

    copy() {
        const copy = this.createConstructor(this.value);
        copy.descriptor = this.descriptor;
        return copy;
    },

    clone() {
        const clone = this.createConstructor(this.value);
        clone.descriptor = Object.assign({}, this.descriptor);
        return clone;
    },

    fill(descriptor) {
        this.descriptor = descriptor;

        if (descriptor.hasOwnProperty('value')) {
            const propertyValue = descriptor.value;
            const valueNode = Lab.match(propertyValue);
            this.appendChild(valueNode);
            valueNode.fill(propertyValue);
        } else {
            if (descriptor.hasOwnProperty('get')) {
                const propertyGetter = descriptor.get;
                const getterNode = Lab.match(propertyGetter);
                this.appendChild(getterNode);
                getterNode.fill(propertyGetter);
            }
            if (descriptor.hasOwnProperty('set')) {
                const propertySetter = descriptor.set;
                const setterNode = Lab.match(propertySetter);
                this.appendChild(setterNode);
                setterNode.fill(propertySetter);
            }
        }
    },

    get name() {
        return this.value;
    },

    set name(name) {
        this.value = name;
    },

    get valueNode() {
        const descriptor = this.descriptor;
        return descriptor.hasOwnProperty('value') ? this.children[0] : null;
    },

    get getterNode() {
        const descriptor = this.descriptor;
        if (descriptor.hasOwnProperty('get')) {
            return this.children[0];
        }
        return null;
    },

    get setterNode() {
        const descriptor = this.descriptor;
        if (descriptor.hasOwnProperty('set')) {
            return this.children.length === 2 ? this.children[1] : this.children[0];
        }
        return null;
    },

    get propertyValue() {
        const valueNode = this.valueNode;
        return valueNode ? valueNode.value : undefined;
    }
});
const CombinePropertyReaction = CombineObjectReaction.extend({
    refine(compositeProperty, firstComponent, secondComponent) {
        const firstDescriptor = firstComponent.descriptor;
        const secondDescriptor = secondComponent.descriptor;
        const compositeDescriptor = Object.assign({}, secondDescriptor);
        const firstType = firstDescriptor.hasOwnProperty('value') ? 'value' : 'accessor';
        const secondType = secondDescriptor.hasOwnProperty('value') ? 'value' : 'accessor';
        const compositePropertyType = firstType + '-' + secondType;

        compositeProperty.descriptor = compositeDescriptor;
        if (compositePropertyType === 'value-value') {
            this.handleConstituant(compositeProperty, 'valueNode', firstComponent, secondComponent);
        } else if (compositePropertyType === 'accessor-value') {
            this.handleConstituant(compositeProperty, 'valueNode', secondComponent);
        } else if (compositePropertyType === 'value-accessor') {
            this.handleConstituant(compositeProperty, 'getterNode', secondComponent);
            this.handleConstituant(compositeProperty, 'setterNode', secondComponent);
        } else if (compositePropertyType === 'accessor-accessor') {
            this.handleConstituant(compositeProperty, 'getterNode', firstComponent, secondComponent);
            this.handleConstituant(compositeProperty, 'setterNode', firstComponent, secondComponent);
        }
    },

    handleConstituant(compositeProperty, constituantName, firstComponent, secondComponent) {
        const firstConstituant = firstComponent[constituantName];
        if (firstConstituant) {
            const secondConstituant = secondComponent ? secondComponent[constituantName] : null;

            let reaction;
            if (firstConstituant && secondConstituant) {
                reaction = firstConstituant.reactWith(secondConstituant, compositeProperty);
            } else if (firstComponent) {
                reaction = firstConstituant.transform(compositeProperty);
            }

            const reactionProduct = reaction.prepare();
            reaction.insert();
            if (constituantName === 'valueNode') {
                compositeProperty.descriptor.value = reactionProduct.value;
            } else if (constituantName === 'getterNode') {
                compositeProperty.descriptor.get = reactionProduct.value;
            } else if (constituantName === 'setterNode') {
                compositeProperty.descriptor.set = reactionProduct.value;
            }
            reaction.proceed();
        }
    }
});
ObjectPropertyElement.refine({
    transformation: CopyTransformation,
    reaction: CombinePropertyReaction
});

const ArrayElement = ObjectElement.extend('Array', createConstructedByProperties(Array), {
    createProperty(name) {
        return ArrayPropertyElement.create(name);
    }
});
ArrayElement.refine({
    generate() {
        return [];
    },

    combine() {
        return [];
    }
});
// we don't know yet the final array value we start from a container array
// and we fill it one property after an other
// once we're done we can freeze the array
// we got the same approach in Lab.scan but we already have the final value
// what we could do to be completely exaustive and prevent the freeze of an object
// passed to compose it to alaways recreate a value no matter what (and I like this concept because more powerful)
// it works for object/array, for error/function etc we will return the value unmodified because they are considered as primitive
// but they will be frozen
const CombineArrayReaction = CombineObjectReaction.extend({
    refine(compositeArray) {
        const combinedLengthProperty = compositeArray.readProperty(compositeArray.value, 'length');
        // in case of conflict this property must stay and it doesn't have to be cloned -> PrevailReaction
        // because the combined array length will try to override this one
        combinedLengthProperty.reaction = PrevailReaction;
        return CombineObjectReaction.refine.apply(this, arguments);
    },

    defineProperty(compositeArray, property) {
        if (property.isIndex()) {
            compositeArray.getProperty('length').valueNode.value++;
        }
        return CombineObjectReaction.defineProperty.apply(this, arguments);
    }
});
ArrayElement.refine({
    reaction: CombineArrayReaction
});
const ArrayPropertyElement = ObjectPropertyElement.extend('ArrayProperty', {
    isIndex: (function() {
        const STRING = 0; // name is a string it cannot be an array index
        const INFINITE = 1; // name is casted to Infinity, NaN or -Infinity, it cannot be an array index
        const FLOATING = 2; // name is casted to a floating number, it cannot be an array index
        const NEGATIVE = 3; // name is casted to a negative integer, it cannot be an array index
        const TOO_BIG = 4; // name is casted to a integer above Math.pow(2, 32) - 1, it cannot be an array index
        const VALID = 5; // name is a valid array index
        const maxArrayIndexValue = Math.pow(2, 32) - 1;

        function getArrayIndexStatusForString(name) {
            if (isNaN(name)) {
                return STRING;
            }
            const number = Number(name);
            if (isFinite(number) === false) {
                return INFINITE;
            }
            if (Math.floor(number) !== number) {
                return FLOATING;
            }
            if (number < 0) {
                return NEGATIVE;
            }
            if (number > maxArrayIndexValue) {
                return TOO_BIG;
            }
            return VALID;
        }

        function isPropertyNameValidArrayIndex(propertyName) {
            return getArrayIndexStatusForString(propertyName) === VALID;
        }

        return isPropertyNameValidArrayIndex;
    })()
});
// currently we have "hardcoded" that concatened properties must be cloned
// (because ArrayConcatTransformation extends CloneTransformation)
// they may be copied instead (by extending CopyTransformation)
// but I'm not sure what is the right choice here. I suppose concatenation does not mean we must clone stuff
// so let's us copy for now
const ArrayPropertyConcatTransformation = CopyTransformation.extend({
    produce(arrayProperty, array) {
        const copy = CopyTransformation.produce.apply(this, arguments);

        const arrayLengthProperty = array.getProperty('length');
        const arrayLength = arrayLengthProperty.propertyValue;
        const conflictualIndex = Number(arrayProperty.name);
        const concatenedIndex = conflictualIndex + arrayLength;
        const concatenedIndexAsString = String(concatenedIndex);

        // now we copy the property
        copy.name = concatenedIndexAsString;

        return copy;
    }
});
ArrayPropertyElement.refine({
    reaction: createDynamicReaction(
        function(arrayProperty) {
            return arrayProperty.isIndex();
        },
        CombinePropertyReaction.extend({
            produce(firstArrayProperty, secondArrayProperty, array) {
                const firstPropertyTransformation = firstArrayProperty.transform(array);
                const secondPropertyTransformation = ArrayPropertyConcatTransformation.create(
                    secondArrayProperty,
                    array
                );

                this.firstTransformation = firstPropertyTransformation;
                this.secondTransformation = secondPropertyTransformation;

                firstPropertyTransformation.prepare();
                secondPropertyTransformation.prepare();
            },

            insert() {
                this.firstTransformation.insert();
                this.secondTransformation.insert();
            },

            refine() {
                this.firstTransformation.proceed();
                this.secondTransformation.proceed();
            }
        }),
        // function(arrayProperty) {
        //     return arrayProperty.name === 'length';
        // },
        // in that case do not combine the length property (it not configurable) and would override
        // the current length which is the right one
        // but right now, reaction cannot do nothing
        CombinePropertyReaction
    )
});

const BooleanElement = ObjectElement.extend('Boolean', createConstructedByProperties(Boolean));
const NumberElement = ObjectElement.extend('Number', createConstructedByProperties(Number));
const StringElement = ObjectElement.extend('String', createConstructedByProperties(String));
// handle function as primitive because perf and impossible to share scope
const FunctionElement = ObjectElement.extend('Function',
    createConstructedByProperties(Function),
    PrimitiveProperties
);
// handle error as primitive because hard to share stack property
const ErrorElement = ObjectElement.extend('Error',
    createConstructedByProperties(Error),
    PrimitiveProperties
);
const RegExpElement = ObjectElement.extend('RegExp', createConstructedByProperties(RegExp));
const DateElement = ObjectElement.extend('Date', createConstructedByProperties(Date));
// to add : MapElement, MapEntryElement, SetElement, SetEntryElement

// ideally combining two string object would produce a string object with the primitive value of the second string
// and properties of both string objects (just like CombineObject does)
// for now this is disabled because if it would work for strings/date/regexp/number/boolean it would
// - impact perf for Function
// - would be hard to do new Error() and preserve the stack property
export {
    ObjectElement,
    ObjectPropertyElement,
    BooleanElement,
    NumberElement,
    StringElement,
    ArrayElement,
    ArrayPropertyElement,
    FunctionElement,
    ErrorElement,
    RegExpElement,
    DateElement
};
