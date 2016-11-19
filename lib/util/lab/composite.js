/* eslint-disable no-use-before-define */

import {Lab, Element} from './lab.js';
import {PrimitiveProperties} from './primitive.js';
import {
    CopyTransformation,
    createDynamicTransformation,
    // CloneTransformation,
    Reaction,
    NoReaction,
    // PrevailReaction,
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
        this.readProperties(value);
    },

    readProperties(value) {
        return Object.getOwnPropertyNames(value).map(function(name) {
            return this.readProperty(value, name);
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

        // set every property that requires to be on instance
        // we know thoose property will exist both in instance & instance prototype
        // donc chaque propriété étant un objet pour le moment
        // doit être copié et mise comme own property de l'instance
        // peut être que ce serais bien de créer, même temporairement
        // un object genre instanceElement
        // pour qu'on manipule toujours un object élément et pas directement
        // une valeur JavaScript

        // for (let property of this) {

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
        // console.log('refine the composite', compositeObject.value);
        const ownProperties = compositeObject.readProperties(compositeObject.value);
        const unhandledSecondProperties = secondComponent.children.slice();
        for (let firstProperty of firstComponent) {
            const ownPropertyIndex = this.findConflictualPropertyIndex(ownProperties, firstProperty);
            if (ownPropertyIndex > -1) {
                const ownProperty = ownProperties[ownPropertyIndex];
                firstProperty = this.handlePropertyCollision(compositeObject, ownProperty, firstProperty);
                if (!firstProperty) {
                    continue;
                }
            }

            const secondPropertyIndex = this.findConflictualPropertyIndex(unhandledSecondProperties, firstProperty);
            if (secondPropertyIndex === -1) {
                this.handleNewProperty(compositeObject, firstProperty, 0);
            } else {
                // handle the conflict and mark the property as handled
                const conflictualSecondProperty = unhandledSecondProperties[secondPropertyIndex];
                unhandledSecondProperties.splice(secondPropertyIndex, 1);
                this.handlePropertyCollision(compositeObject, firstProperty, conflictualSecondProperty);
            }
        }

        for (let secondProperty of unhandledSecondProperties) {
            const ownPropertyIndex = this.findConflictualPropertyIndex(ownProperties, secondProperty);
            if (ownPropertyIndex > -1) {
                const ownProperty = ownProperties[ownPropertyIndex];
                this.handlePropertyCollision(compositeObject, ownProperty, secondProperty);
            } else {
                this.handleNewProperty(compositeObject, secondProperty, 1);
            }
        }

        // console.log('freeze the composite', compositeObject.value);
        Object.freeze(compositeObject.value);
    },

    findConflictualPropertyIndex(properties, possiblyConflictualProperty) {
        return properties.findIndex(function(property) {
            return property.isConflictingWith(possiblyConflictualProperty);
        });
    },

    handlePropertyCollision(compositeObject, property, conflictualProperty) {
        // here we could impvoe perf by finding the appropriat reaction and if the reaction
        // is to clone currentProperty we can do nothing because it's already there
        const reaction = property.reactWith(conflictualProperty, compositeObject);
        const importedProperty = reaction.prepare();
        reaction.insert();
        reaction.proceed();
        return importedProperty;
    },

    handleNewProperty(compositeObject, property, index) {
        const transformation = property.transform(compositeObject, index);
        const importedProperty = transformation.prepare();
        transformation.insert();
        transformation.proceed();
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

    effect() {
        // console.log('define property', this.name, '=', this.descriptor, 'on', object.value);
        const object = this.parentNode;
        if (object) {
            Object.defineProperty(object.value, this.name, this.descriptor);
        }
    },

    isConflictingWith(otherProperty) {
        return this.name === otherProperty.name;
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
    },

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

        return function() {
            return isPropertyNameValidArrayIndex(this.name);
        };
    })()
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
            if (constituantName === 'valueNode') {
                compositeProperty.descriptor.value = reactionProduct.value;
            } else if (constituantName === 'getterNode') {
                compositeProperty.descriptor.get = reactionProduct.value;
            } else if (constituantName === 'setterNode') {
                compositeProperty.descriptor.set = reactionProduct.value;
            }
            reaction.insert();
            reaction.proceed();
        }
    }
});
const SafeCombineProperty = createDynamicReaction(
    function(firstProperty, secondProperty, compositeObject) {
        if (firstProperty.descriptor.configurable === false && firstProperty.parentNode === compositeObject) {
            // this case happens with array length property
            // or function name property, in that case we preserve the current property of the compositeObject
            // console.log('own property is not configurable, cannot make it react');
            return true;
        }
        return false;
    },
    NoReaction,
    CombinePropertyReaction
);
ObjectPropertyElement.refine({
    transformation: CopyTransformation,
    reaction: SafeCombineProperty
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
const ArrayPropertyElement = ObjectPropertyElement.extend('ArrayProperty', {
    effect() {
        const array = this.parentNode;
        if (array && this.isIndex()) {
            array.getProperty('length').valueNode.value++;
        }
        return ObjectPropertyElement.effect.apply(this, arguments);
    }
});
// currently we have "hardcoded" that concatened properties must be cloned
// (because ArrayConcatTransformation extends CloneTransformation)
// they may be copied instead (by extending CopyTransformation)
// but I'm not sure what is the right choice here. I suppose concatenation does not mean we must clone stuff
// so let's us copy for now but keep in mind we may want to copy as well
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
        // console.log(copy.descriptor.value, 'index updated to', concatenedIndex, 'from', conflictualIndex);

        return copy;
    }
});
ArrayPropertyElement.refine({
    isConflictingWith(otherProperty) {
        const propertyHaveSameName = this.name === otherProperty.name;

        // ignore conflict when property wants to be concatened
        // this.transformation === ArrayPropertyConcatTransformation
        if (propertyHaveSameName && this.isIndex()) {
            // console.log('ignoring conflict for', this.name, 'because it will be concatened');
            return false;
        }
        return propertyHaveSameName;
    },

    transformation: createDynamicTransformation(
        // il ne faut concatener que les propriétés étant des index ETTTTT étant dans le second tableau
        // là on le fait pour les deux
        // un moyen de savoir serais de passer l'info en argument à Transformation
        // est ce que cette transformation vient d'une
        function(arrayProperty, array, compositionIndex) {
            // console.log('isIndex ?', arrayProperty.name, arrayProperty.isIndex());
            return arrayProperty.isIndex() && compositionIndex > 0;
        },
        ArrayPropertyConcatTransformation,
        CopyTransformation
    ),
    reaction: createDynamicReaction(
        function(arrayProperty) {
            // we disable reaction concerning the length property as it would mutate the array
            // instead we manually increase the length property when indexed property are added
            // because length property is non configurable by default this check is not mandatory
            // as length would be ignored by SafeCombineProperty
            // but this is "luck" so don't rely on luck, be explicit
            // if tomorrow JS engine decide length property is configurable this will still work
            // so we are more robust
            return arrayProperty.name === 'length';
        },
        NoReaction,
        SafeCombineProperty
    )
});

const BooleanElement = ObjectElement.extend('Boolean', createConstructedByProperties(Boolean));
const NumberElement = ObjectElement.extend('Number', createConstructedByProperties(Number));
const StringElement = ObjectElement.extend('String', createConstructedByProperties(String));
const RegExpElement = ObjectElement.extend('RegExp', createConstructedByProperties(RegExp));
const DateElement = ObjectElement.extend('Date', createConstructedByProperties(Date));
// handle function as primitive because perf
const FunctionElement = ObjectElement.extend('Function',
    createConstructedByProperties(Function),
    PrimitiveProperties
);
// handle error as primitive because hard to preserve stack property
const ErrorElement = ObjectElement.extend('Error',
    createConstructedByProperties(Error),
    PrimitiveProperties
);
// to add : MapElement, MapEntryElement, SetElement, SetEntryElement

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
