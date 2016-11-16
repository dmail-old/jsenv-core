/* eslint-disable no-use-before-define, no-new-wrappers */

// https://github.com/traitsjs/traits.js#composing-traits
// we may want to throw when two property are in conflict, but maybe it's more that we want to throw when two function are in conflict
// well it's hard to know for now when we want to throw for now we never throw we just resolve conflict by replace/combine
// we may later decide to create some temp unstableComposition which are throw when compiled
// and to provide some wau to make it stable by using replace(), combine() or other strategy to resolve the conflict
// but for now keep as it is
// note : JavaScript allow array & object to be combined, in the same fashion Array & Set may be combined as well
// for now we ignore thoose exotic case
import util from './util.js';

import {
    Element,
    NullPrimitiveElement,
    UndefinedPrimitiveElement,
    BooleanPrimitiveElement,
    NumberPrimitiveElement,
    StringPrimitiveElement,
    ObjectElement,
    ObjectPropertyElement,
    ArrayElement,
    ArrayPropertyElement,
    FunctionElement,
    RegExpElement,
    StringElement,
    DateElement,
    ErrorElement
} from './lab.js';

Element.refine({
    compose(secondElement) {
        const reaction = this.reactWith(secondElement);
        const product = reaction.prepare();
        reaction.proceed();
        return product;
    },

    reactWith(secondElement, parentNode) {
        const firstElement = this.asElement();
        let reaction = firstElement.reaction;

        return reaction.create(firstElement, secondElement, parentNode);
    },

    transform(parentNode) {
        const transformation = this.transformation.create(this, parentNode);
        return transformation;
    },

    asElement() {
        // pointerNode will return the pointedElement
        // doing ctrl+c & ctrl+v on a symlink on windows copy the symlinked file and not the symlink
        return this;
    }
});

// transformation of an element into an other
const Transformation = util.extend({
    constructor() {
        this.args = arguments;
    },

    prepare() {
        const product = this.produce(...this.args);
        this.product = product;
        return product;
    },

    proceed() {
        const product = this.product;
        this.refine(product, ...this.args);
        return product;
    }
});

// reaction is a transformation involving two elements
const Reaction = Transformation.extend();

const CopyTransformation = Transformation.extend({
    produce(element) {
        const copy = element.createConstructor(element.value);
        return copy;
    },

    refine(product, element) {
        // must copy all children
        for (let child of element) {
            const childCopy = this.produce(child);
            product.appendChild(childCopy);
            this.refine(childCopy, child);
        }

        return product;
    }
});

const CopyObjectPropertyTransformation = CopyTransformation.extend();

const CloneTransformation = Transformation.extend({
    produce(element) {
        const clonedValue = this.produceClone(element.value);
        const clone = element.createConstructor(clonedValue);

        return clone;
    },

    produceClone(value) {
        // must be implemented: how to clone the value ?
        return value;
    },

    refineClone() {
        // Object.freeze()?
    },

    refine(product, element) {
        // must copy all children
        for (let child of element) {
            const childClone = this.produce(child);
            product.appendChild(childClone);
            this.refine(childClone, child);
        }
        return product;
    }
});

const ReplaceReaction = Reaction.extend({
    constructor(firstElement, secondElement) {
        // shouldn't we consider replace as using copy and not clone ?
        return CloneTransformation.create(secondElement);
    }
});

const CombineObjectReaction = Reaction.extend({
    produce(firstObject, secondObject) {
        const firstValue = firstObject.value;
        const secondValue = secondObject.value;
        const compositeValue = this.produceComposite(firstValue, secondValue);
        // console.log('the catalyst element name', Object.getPrototypeOf(catalystElement).name);
        const compositeObject = firstObject.createConstructor(compositeValue);
        // mergedElement.populate(firstElement);
        // mergedElement.value = mergedValue;

        // mergedElement.firstComponent = firstElement;
        // mergedElement.secondComponent = secondElement;
        // not needed we got the reaction property holding this information
        // si firstElement et/ou secondElement sont le produit d'une réaction il faut garde cette info

        return compositeObject;
    },

    // produceHybrid ?
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
    },

    handlePropertyCollision(element, property, conflictualProperty) {
        // here we could impvoe perf by finding the appropriat reaction and if the reaction
        // is to clone currentProperty we can do nothing because it's already there
        const reaction = property.reactWith(conflictualProperty, element);
        const importedProperty = reaction.prepare();
        this.addProperty(element, importedProperty);
        reaction.proceed();
        return importedProperty;
    },

    handleNewProperty(element, property) {
        const transformation = property.transform(element);
        const importedProperty = transformation.prepare();
        this.addProperty(element, importedProperty);
        transformation.proceed();
        return importedProperty;
    },

    addProperty(element, property) {
        element.appendChild(property);
    }
});

const CloneObjectTransformation = CloneTransformation.extend({
    produceClone() {
        return {};
    }
});

const CloneArrayTransformation = CloneTransformation.extend({
    produceClone() {
        return [];
    }
});

// const ReverseReplaceReaction = Reaction.extend({
//     constructor(firstElement, secondElement) {
//         return ReplaceReaction.create(secondElement, firstElement);
//     }
// });

// const ReverseCombineObjectReaction = Reaction.extend({
//     constructor(firstElement, secondElement) {
//         return CombineObjectReaction.create(secondElement, firstElement);
//     }
// });

const CombinePropertyReaction = CombineObjectReaction.extend({
    produceComposite(firstComponentName, secondComponentName) {
        return secondComponentName;
    },

    refine(compositeProperty, firstComponent, secondComponent) {
        const firstDescriptor = firstComponent.descriptor;
        const secondDescriptor = secondComponent.descriptor;

        let situation = firstDescriptor.hasOwnProperty('value') ? 'value' : 'accessor';
        situation += '-';
        situation += secondDescriptor.hasOwnProperty('value') ? 'value' : 'accessor';

        // bah c'est cool mais aucun des deux n'est actuellement dans l'arbre, ils proviennent d'un autre arbre
        if (situation === 'value-value') {
            this.handleConstituant(compositeProperty, 'valueNode', firstComponent, secondComponent);
        } else if (situation === 'accessor-value') {
            this.handleConstituant(compositeProperty, 'valueNode', secondComponent);
        } else if (situation === 'value-accessor') {
            this.handleConstituant(compositeProperty, 'getterNode', secondComponent);
            this.handleConstituant(compositeProperty, 'setterNode', secondComponent);
        } else if (situation === 'accessor-accessor') {
            this.handleConstituant(compositeProperty, 'getterNode', firstComponent, secondComponent);
            this.handleConstituant(compositeProperty, 'setterNode', firstComponent, secondComponent);
        }
    },

    handleComponent(compositeProperty, constituantName, firstComponent, secondComponent) {
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
            compositeProperty[constituantName] = reactionProduct;
            reaction.proceed();
        }
    }
});

const PrevailReaction = Reaction.extend({
    produce(element) {
        return element;
    },

    refine() {

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
        // combining two array creates an empty array
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

const createDynamicReaction = function(...args) {
    const reactions = args.filter(function(arg) {
        return typeof arg !== 'function';
    });
    const matchers = args.filter(function(arg) {
        return typeof arg === 'function';
    });

    return Reaction.extend({
        constructor(...reactionArgs) {
            const matchIndex = matchers.findIndex(function(matcher) {
                return matcher(...reactionArgs);
            });

            let reaction;
            if (matchIndex === -1) {
                reaction = reactions[reactions.length - 1];
            } else {
                reaction = reactions[matchIndex];
            }

            return reaction.create(...reactionArgs);
        }
    });
};

Element.refine({
    transformation: CopyTransformation
});
ObjectElement.refine({
    reaction: CombineObjectReaction,
    transformation: CloneObjectTransformation
});
ObjectPropertyElement.refine({
    reaction: CombinePropertyReaction,
    transformation: CopyObjectPropertyTransformation
});
ArrayElement.refine({
    reaction: CombineArrayReaction,
    transformation: CloneArrayTransformation
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
NullPrimitiveElement.refine({
    reaction: ReplaceReaction
});
UndefinedPrimitiveElement.refine({
    reaction: ReplaceReaction
});
BooleanPrimitiveElement.refine({
    reaction: ReplaceReaction
});
NumberPrimitiveElement.refine({
    reaction: ReplaceReaction
});
StringPrimitiveElement.refine({
    reaction: ReplaceReaction
});
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
StringElement.refine({
    reaction: ReplaceReaction
});
FunctionElement.refine({
    reaction: ReplaceReaction
    // merge(firstFunction, secondFunction) {
    //     return function() {
    //         firstFunction.apply(this, arguments);
    //         return secondFunction.apply(this, arguments);
    //     };
    // }
    // transformSurroundedFragment(firstFunction, secondFunction, thirdFunction) {
    //     return function() {
    //         return secondFunction.call(this, firstFunction, thirdFunction, arguments, this);
    //     };
    // }
});
// error may be composed together it has some meaning but for now keep it simple
ErrorElement.refine({
    reaction: ReplaceReaction
});
RegExpElement.refine({
    reaction: ReplaceReaction
});
DateElement.refine({
    reaction: ReplaceReaction
});

/*
Element.refine({
    // resolve(mergeConflictResolver) {
    //     const resolvedElement = this.clone();
    //     resolvedElement.resolver = mergeConflictResolver;
    //     mergeConflictResolver.resolveNow(this);
    //     return resolvedElement;
    // },

    // createFragment() {
    //     const fragment = this.createConstructor();
    //     fragment.compile = function() {
    //         const childrenCompileResult = this.children.map(function(child) {
    //             return child.compile();
    //         });

    //         if (childrenCompileResult.length === 2) {
    //             return this.transformCombinedFragment(...childrenCompileResult);
    //         }
    //         return this.transformSurroundedFragment(...childrenCompileResult);
    //     };
    //     return fragment;
    // },

    // transformFragment() {
    //     throw new Error('unimplemented transformFragment');
    // },

    // prepend(element) {
    //     const fragment = this.createFragment();
    //     this.replace(fragment);
    //     fragment.appendChild(element.clone());
    //     fragment.appendChild(this);
    //     return fragment;
    // },

    // append(element) {
    //     const fragment = this.createFragment();
    //     this.replace(fragment);
    //     fragment.appendChild(this);
    //     fragment.appendChild(element.clone());
    //     return fragment;
    // },

    // surround(previousElement, nextElement) {
    //     const fragment = this.createFragment();
    //     this.replace(fragment);
    //     fragment.appendChild(previousElement.clone());
    //     fragment.appendChild(this);
    //     fragment.appendChild(nextElement.clone());
    //     return fragment;
    // }
});
*/

/*
// I suppose null, undefined, true/false, may not be combined
// however object may be combined in the same fashion instead of using mergeProperties we could
// create objectFragment (by default mergeProperties would mean append)
// prepend would allow a great feature which is to put merged object properties first

donc c'est super mais je vois un problème:

objectA.merge(objectB)
ok on créer une sorte d'object composite du genre
objectC = [objectA, objectB]
par contre c'est relou parce qu'on ignore complètement si les propriétés vont collisioner
cela pourrait se faire à la compilation mais est-ce correct de voir les choses comme ça je ne sais pas
si je crée une version combiné des deux objets je perd data ou alors au moment de créer le object fragment
on aura effectivement objectFragment = [objectA, objectB]
ok non en fait voilà ce qu'il se passe : on merge direct
objectA et objectB disparait au profit de objectC qui est un object utilisant les propriété de A et B mergé
cas particulier:
objectA.self = objectA, objectB.me = objectB
alors objectC.self === objectC & objectC.me === objectC

même function et string devrait faire ça : devenir une seule entité immédiatemment et pas à la compilation
compile ne feras que retourner la fonction cmoposé ou un clone de la fonction composé
pareil pour les objet: créer un clone de l'objet composé
le seul truc qu'il faudrait garde c'est que si on veut serialize la fonction correspondante il faut connaitre
les fonction qui compose la fonction finale, si on compose et qu'on perd cette info on ne peut plus serialize
il faudrais peut être conserver quelque chose comme la source de la fonction comme une propriété de ladite fonction de sorte
qu'on peut combiner cette propriété pour la version composé ? ou quelque chose comme ça (et la combination des sources résulterait en un tableau)
de plus les références vers les object non combiné devrait toutes pointer vers les objets combiné est ce seulement possible

il faudrais activer ou non prepend/append/surround en fonction de chaque element
certain supporte aucune, une partie ou toutes ces méthodes
*/

// would also imagine a resolver which adds number, multiply them, divide them etc
// the amount of possible resolver is infinite and we must provide an api
// allowing to use different resolver depending on the element AND the conflictualElement (and not a resolver per element ignoring the conflictual one)
/*
- resolver may say hey I'm working with a first argument which is a function and a second is a string
to make it simple if a resolver has many signature it must be expressed by polymorphism

on a aussi besoin ensuite de pouvoir dire voici la liste des résolveurs associé à cet élement
donc en gros le premier resolver qui match on l'utilise

// on pourrait avoir une sorte de merge conflict resolution config par élement qui dit
// pour moi même et mes descendants voici la config en cas de merge conflict
// et chaque element descendant peut override cette config et en hérite par défaut (genre CSS)
// sauf que cette info devrait être mise sur Element puisque tous les sous éléments en hérite
mais ce n'est actuellement pas possible de redéfinir ça quand on veut ou alors faudrais Element.config
qui pourrais être override par String.config override elle-même par string.config
ignorons ce problème pour le moment qui est bien avancé et mettons en place comme si c'était bon sur Element.config
*/

// function composeFunction(firstFunction, secondFunction, compositionHandler) {
//     let functionFragment;

//     if (compositionHandler) {
//         const surroundedElement = FunctionObjectElement.create().write(compositionHandler);
//         functionFragment = surroundedElement.surround(firstFunction, secondFunction);
//     } else {
//         functionFragment = firstFunction.append(secondFunction);
//     }

//     return functionFragment;
// }

// rename must be available only for objectPropertyElement
// ResolverStore.register('rename', {
//     constructor(renameWith) {
//         this.renameWith = renameWith;
//     },
    // elementMatcher: 'any'
    // ne pas utiliser resolveNow maintenant y'a que un resolveLater qui peut être dynamique
    // resolveNow(element, properties, conflictResolverMap) {
    //     let resolvedProperty;
    //     const renameWith = this.renameWith;

    //     // property.name = renameWith;
    //     // check if rename creates an internal conflict
    //     const conflictualProperty = properties.get(renameWith);

    //     if (conflictualProperty) {
    //         var message = 'conflict must not be handled by renaming "' + property.name + '" -> "' + renameWith;
    //         message += '" because it already exists';
    //         let error = property.createConflictError(
    //             conflictualProperty,
    //             message,
    //             'resolve({rename: \'' + renameWith + '-free\'})'
    //         );
    //         throw error;
    //     } else {
    //         const renamedProperty = property.rename(renameWith);
    //         resolvedProperty = properties.resolveProperty(renamedProperty, conflictResolverMap);
    //     }

    //     return resolvedProperty;
    // }
// });
