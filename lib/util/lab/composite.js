/* eslint-disable no-use-before-define */

import {Lab, Element} from './lab.js';
import {PrimitiveProperties} from './primitive.js';
import {
    CopyTransformation,
    CloneTransformation,
    Reaction,
    PrevailReaction,
    createDynamicReaction
} from './transformation.js';

const ObjectElement = Element.extend('Object', {
    // hooks: Object.assign(Element.hooks, {
    //     // c'est pas childAdded mais plutot lorsque l'enfant est finalement prêt
    //     // c'est à dire lorsque le child.descriptor existe
    //     childAdded(child) {
    //         if (this.frozen === false) {
    //             // console.log('defining property', child.descriptor);
    //             Object.defineProperty(this.value, child.name, child.descriptor);
    //         }
    //     },
    //     childRemoved(child) {
    //         if (this.frozen === false) {
    //             delete this.value[child.name];
    //         }
    //     }
    // }),

    match(value) {
        return this.Prototype.isPrototypeOf(value);
    },
    Prototype: Object.prototype,

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
        propertyNode.fill(descriptor);
        // console.log('defining', name, 'on', this.value, 'with descriptor', propertyNode.descriptor);
        // Object.defineProperty(this.value, name, propertyNode.descriptor);

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
ObjectElement.refine({
    copy() {
        const copy = this.createConstructor(this.value);
        return copy;
    },

    clone() {
        const clone = this.createConstructor({});
        return clone;
    }
});
const CombineObjectReaction = Reaction.extend({
    produce(firstObject, secondObject) {
        const firstValue = firstObject.value;
        const secondValue = secondObject.value;
        const compositeValue = this.produceComposite(firstValue, secondValue);
        const compositeObject = firstObject.createConstructor(compositeValue);

        return compositeObject;
    },

    produceComposite() {
        // combining two objects result into one object
        return {};
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
        this.addProperty(compositeObject, importedProperty);
        reaction.proceed();
        Object.defineProperty(compositeObject.value, importedProperty.name, importedProperty.descriptor);
        return importedProperty;
    },

    handleNewProperty(compositeObject, property) {
        const transformation = property.transform(compositeObject);
        const importedProperty = transformation.prepare();
        this.addProperty(compositeObject, importedProperty);
        transformation.proceed();
        Object.defineProperty(compositeObject.value, importedProperty.name, importedProperty.descriptor);
        return importedProperty;
    },

    addProperty(compositeObject, property) {
        compositeObject.appendChild(property);
    }
});
ObjectElement.refine({
    transformation: CopyTransformation,
    reaction: CombineObjectReaction
});

// we may improve perf by splitting case (value, setter only, getter only, setter+getter)
const ObjectPropertyElement = Element.extend('ObjectProperty', {
    // hooks: Object.assign(Element.hooks, {
    //     added() {
    //         if (this.syncEnabled) {
    //             this.parentNode.data[this.name] = this.children[0].data;
    //         }
    //     },
    //     removed() {
    //         if (this.syncEnabled) {
    //             delete this.parentNode.data[this.name];
    //         }
    //     }
    // }),
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
ObjectPropertyElement.refine({
    copy() {
        const copy = this.createConstructor(this.value);
        copy.descriptor = this.descriptor;
        return copy;
    },

    clone() {
        const clone = this.createConstructor(this.value);
        clone.descriptor = Object.assign({}, this.descriptor);
        return clone;
    }
});
const CombinePropertyReaction = CombineObjectReaction.extend({
    produceComposite(firstComponentName, secondComponentName) {
        return secondComponentName;
    },

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
            compositeProperty.appendChild(reactionProduct);
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

function createConstructedByProperties(Constructor) {
    return {
        match(value) {
            return Constructor.prototype.isPrototypeOf(value);
        },

        generate(value) {
            return new Constructor(value.valueOf());
        }
    };
}

const ArrayElement = ObjectElement.extend('Array', createConstructedByProperties(Array), {
    hooks: Object.assign({}, ObjectElement.hooks, {
        childAdded(child) {
            if (child.isIndex()) {
                this.getProperty('length').valueNode.value++;
            }
        },
        childRemoved(child) {
            if (child.isIndex()) {
                this.getProperty('length').valueNode.value--;
            }
        }
    }),

    createProperty(name) {
        return ArrayPropertyElement.create(name);
    }
});
ArrayElement.refine({
    clone() {
        const clone = this.createConstructor([]);
        return clone;
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
    produceComposite() {
        return [];
    },

    refine(compositeArray) {
        const combinedLengthProperty = compositeArray.readProperty('length');
        // in case of conflict this property must stay and it doesn't have to be cloned -> PrevailReaction
        // because the combined array length will try to override this one
        combinedLengthProperty.reaction = PrevailReaction;
        return CombineObjectReaction.refine.apply(this, arguments);
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
const ArrayPropertyConcatTransformation = CloneTransformation.extend({
    produceClone() {
        return '';
    },

    produce(arrayProperty, array) {
        // depending on some conf we may use CopyTransformation instead of cloneTransformation
        // this would allow control if concat clone concatened entries or just concat them
        const clone = CloneTransformation.produce.apply(this, arguments);

        const arrayLengthProperty = array.getProperty('length');
        const arrayLength = arrayLengthProperty.propertyValue;
        const conflictualIndex = Number(arrayProperty.name);
        const concatenedIndex = conflictualIndex + arrayLength;
        const concatenedIndexAsString = String(concatenedIndex);

        // now we copy the property
        clone.name = concatenedIndexAsString;

        return clone;
    }
});
ArrayPropertyElement.refine({
    reaction: createDynamicReaction(
        function(arrayProperty) {
            return arrayProperty.isIndex();
        },
        CombinePropertyReaction.extend({
            produce(firstArrayProperty, secondArrayProperty, array) {
                const propertyDuo = Element.createFragment();
                const firstPropertyTransformation = firstArrayProperty.transform(array);
                const secondPropertyTransformation = ArrayPropertyConcatTransformation.create(
                    secondArrayProperty,
                    array
                );
                const importedFirstProperty = firstPropertyTransformation.prepare();
                const importedSecondProperty = secondPropertyTransformation.prepare();

                propertyDuo.appendChild(importedFirstProperty);
                propertyDuo.appendChild(importedSecondProperty);
                propertyDuo.firstPropertyTransformation = firstPropertyTransformation;
                propertyDuo.secondPropertyTransformation = secondPropertyTransformation;

                return propertyDuo;
            },

            refine(propertyDuo) {
                propertyDuo.firstPropertyTransformation.proceed();
                propertyDuo.secondPropertyTransformation.proceed();
            }
        }),
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
// const CombineStringReaction = CombineObjectReaction.extend({
//     merge(firstString, secondString) {
//         return new String(secondString);
//     }
// });

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
