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
        const reaction = this.collide(secondElement);
        reaction.propagate();
        return reaction.result;
    },

    collide(secondElement) {
        const reaction = this.reactWith(secondElement);
        return reaction;
    },

    reactWith(secondElement) {
        const firstElement = this.asElement();
        let reaction = firstElement.reaction;

        return reaction.create(firstElement, secondElement);
    },

    asElement() {
        // pointerNode will return the pointedElement
        // doing ctrl+c & ctrl+v on a symlink on windows copy the symlinked file and not the symlink
        return this;
    },

    clone(deep = false) {
        const clone = this.createConstructor(this.value);

        clone.populate(this);
        if (deep) {
            clone.cloneChildren(this, true);
        }

        return clone;
    },

    populate(element) {
        // get all property except parentNode, children and copy them (we could also delete them afterwards)
        Object.keys(element).filter(function(name) {
            return ['parentNode', 'children', 'propagateReaction'].includes(name) === false;
        }).forEach(function(name) {
            this[name] = element[name];
        }, this);
    },

    cloneChildren(element, deep = true) {
        for (let child of element) {
            this.appendChild(child.clone(deep));
        }
    }
});

const Reaction = util.extend({
    constructor() {
        this.args = arguments;
        this.react(...this.args);

        // il y a un problème :
        // fait que plus tard clone() voudras set cette propriété
        // de plus j'utilisais element.firstComponent pour garder une trace de comment un object est combiné
        // si cette info se trouve sur combinedElement.reaction il ne faut pas perdre cette info
        // une manière de faire pourrais être de faire combinedElement.reaction.reaction lorsque la reaction à elle-même
        // une reaction
    }
});

const ReplaceReaction = Reaction.extend({
    react(firstElement, secondElement) {
        this.result = secondElement.clone(false);

        // si le second élément était lui même le produit d'une réaction il faut garder cette trace
        // comment savoir ça ? pour le moment je sais pas je n'ai pas prévu de moyen de dire qu'un élémént
        // est le produit d'une reaction
        // c'est important pour les circular reference (on peut savoir d'où provient un objet et ainsi faire pointer les références vers
        // l'objet fusionné
        // et pour la serialization (on peut recréer une valeur provenant de plusieurs sources (fonction par ex)
        this.reaction = secondElement.reaction;
    },

    propagate() {
        this.result.cloneChildren(this.args[1], true);
    }
});

const CombineObjectReaction = Reaction.extend({
    react(firstElement, secondElement) {
        const firstElementValue = firstElement.value;
        const secondElementValue = secondElement.value;
        const mergedValue = this.merge(firstElementValue, secondElementValue);
        // console.log('the catalyst element name', Object.getPrototypeOf(catalystElement).name);
        const mergedElement = firstElement.createConstructor(mergedValue);
        mergedElement.populate(firstElement);

        // mergedElement.firstComponent = firstElement;
        // mergedElement.secondComponent = secondElement;
        // not needed we got the reaction property holding this information

        this.result = mergedElement;

        // si firstElement et/ou secondElement sont le produit d'une réaction il faut garde cette info
    },

    merge() {
        // combining two objects result into one object
        return {};
    },

    propagate() {
        // ok le seul truc qui me dérange c'est que je clone deux fois dans le cas où
        // firstComponent à une prop name et secondComponent aussi et si la start c'est ignore
        // mais on s'en fous
        this.importProperties(this.args[0]);
        this.importProperties(this.args[1]);
    },

    importProperties(objectElement) {
        for (let property of objectElement) {
            this.importProperty(property);
        }
    },

    importProperty(property) {
        const propertyToImport = property.asElement();
        const parentElement = this;
        const currentProperty = parentElement.getProperty(propertyToImport.name);

        let importedProperty;
        if (currentProperty) {
            // here we could impvoe perf by finding the appropriat reaction and if the reaction
            // is to clone currentProperty we can do nothing because it's already there
            importedProperty = currentProperty.collide(propertyToImport);
            parentElement.replaceChild(currentProperty, importedProperty);
            importedProperty.propagateReaction();
        } else {
            importedProperty = this.cloneReaction(propertyToImport);
            parentElement.appendChild(importedProperty);
            importedProperty.propagateReaction();
        }

        return importedProperty;
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

const CombinePropertyReaction = Reaction.extend({
    merge(firstPropertyName) {
        return firstPropertyName;
    },

    propagate() {
        const combinedProperty = this;
        const firstProperty = combinedProperty.firstComponent;
        const secondProperty = combinedProperty.secondComponent;
        const firstDescriptor = firstProperty.descriptor || {value: undefined};
        const secondDescriptor = secondProperty.descriptor || {value: undefined};
        const combinedDescriptor = combinedProperty.descriptor || {};

        let situation = firstDescriptor.hasOwnProperty('value') ? 'value' : 'accessor';
        situation += '-';
        situation += secondDescriptor.hasOwnProperty('value') ? 'value' : 'accessor';

        // bah c'est cool mais aucun des deux n'est actuellement dans l'arbre, ils proviennent d'un autre arbre
        if (situation === 'value-value') {
            combinedDescriptor.writable = secondDescriptor.writable;
            combinedDescriptor.enumerable = secondDescriptor.enumerable;
            combinedDescriptor.configurable = secondDescriptor.configurable;

            const firstPropertyValueElement = firstProperty.children[0];
            const secondPropertyValueElement = secondProperty.children[0];
            const reactingPropertyValue = firstPropertyValueElement.collide(secondPropertyValueElement);
            combinedProperty.appendChild(reactingPropertyValue);
            reactingPropertyValue.propagateReaction();
        } else {
            // ignore other cases for now
        }
    }
    // if (situation === 'value-value') {
    //     selfDescriptor.writable = otherDescriptor.writable;
    //     selfDescriptor.enumerable = otherDescriptor.enumerable;
    //     selfDescriptor.configurable = otherDescriptor.configurable;

    //     // merge values
    //     objectPropertyElement.valueNode.merge(conflictualObjectPropertyElement.valueNode);
    // } else if (situation === 'accessor-value') {
    //     selfDescriptor.writable = otherDescriptor.writable;
    //     selfDescriptor.enumerable = otherDescriptor.enumerable;
    //     selfDescriptor.configurable = otherDescriptor.configurable;

    //     // remove accessors
    //     const getterNode = objectPropertyElement.getterNode;
    //     if (getterNode) {
    //         getterNode.remove();
    //         delete objectPropertyElement.getterNode;
    //         delete selfDescriptor.get;
    //     }
    //     const setterNode = objectPropertyElement.setterNode;
    //     if (setterNode) {
    //         setterNode.remove();
    //         delete objectPropertyElement.setterNode;
    //         delete selfDescriptor.set;
    //     }
    //     // use value
    //     objectPropertyElement.valueNode = objectPropertyElement.createNode();
    //     objectPropertyElement.valueNode.import(conflictualObjectPropertyElement.valueNode);
    //     selfDescriptor.value = objectPropertyElement.valueNode.value;
    // } else if (situation === 'value-accessor') {
    //     selfDescriptor.enumerable = otherDescriptor.enumerable;
    //     selfDescriptor.configurable = otherDescriptor.configurable;

    //     // remove value
    //     objectPropertyElement.valueNode.remove();
    //     delete objectPropertyElement.valueNode;
    //     delete selfDescriptor.value;
    //     // use accessor
    //     const getterNode = conflictualObjectPropertyElement.getterNode;
    //     if (getterNode) {
    //         objectPropertyElement.getterNode = objectPropertyElement.createNode();
    //         objectPropertyElement.getterNode.import(getterNode);
    //         selfDescriptor.get = getterNode.value;
    //     }
    //     const setterNode = conflictualObjectPropertyElement.setterNode;
    //     if (setterNode) {
    //         objectPropertyElement.setterNode = objectPropertyElement.createNode();
    //         objectPropertyElement.setterNode.import(setterNode);
    //         selfDescriptor.set = setterNode.value;
    //     }
    // } else if (situation === 'accessor-accessor') {
    //     selfDescriptor.enumerable = otherDescriptor.enumerable;
    //     selfDescriptor.configurable = otherDescriptor.configurable;

    //     // merge accessors
    //     const getterNode = conflictualObjectPropertyElement.getterNode;
    //     if (getterNode) {
    //         let selfGetterNode = objectPropertyElement.getterNode;
    //         if (selfGetterNode) {
    //             selfGetterNode.merge(getterNode);
    //         } else {
    //             selfGetterNode = objectPropertyElement.createNode();
    //             objectPropertyElement.getterNode = selfGetterNode;
    //             selfGetterNode.import(getterNode);
    //         }
    //         selfDescriptor.get = selfGetterNode.value;
    //     }
    //     const setterNode = conflictualObjectPropertyElement.setterNode;
    //     if (setterNode) {
    //         let selfSetterNode = objectPropertyElement.setterNode;
    //         if (selfSetterNode) {
    //             selfSetterNode.merge(getterNode);
    //         } else {
    //             selfSetterNode = objectPropertyElement.createNode();
    //             objectPropertyElement.setterNode = selfSetterNode;
    //             selfSetterNode.import(getterNode);
    //         }
    //         selfDescriptor.get = selfSetterNode.value;
    //     }
    // }
    //
    // return objectPropertyElement;
});

const DynamicIndexConcatenationReaction = Reaction.extend({
    match(element) {
        // what do we do when the property is not an index ?
        // we should do combine but we could also do something different
        // for now ignore but we need this level of configurability
        // for that we may introduce ReactionList that would do one reaction in the list
        // each reaction in the list would have an associated matcher that must return true for the element
        return (
            ArrayPropertyElement.isPrototypeOf(element) &&
            element.isIndex()
        );
    },

    react(firstArrayProperty, secondArrayProperty) {
        const firstArray = firstArrayProperty.parentNode;
        const firstArrayLengthProperty = firstArray.getProperty('length');
        const firstArrayLength = firstArrayLengthProperty.propertyValue;
        const firstPropertyIndex = Number(firstArrayProperty.name);
        const concatenedIndex = firstPropertyIndex + firstArrayLength;
        const concatenedName = String(concatenedIndex);

        const concatenedPropertyReaction = ReplaceReaction.create(firstArrayProperty, secondArrayProperty);
        const concatenedProperty = concatenedPropertyReaction.result;

        concatenedProperty.name = concatenedName;
        concatenedProperty.reaction = concatenedPropertyReaction;

        // juste un truc : la propriété length peut ne pas valoir la bonne length si
        // seulement une partie des indexs sont concat et une autre sont combinés
        // soit on ignore la propriété length mais un tableau ne pourras pas redéfinir sa proprpre propriété length
        // soit on met à jour length = length + 1 à chaque fois qu'on concat un index -> solution plutôt cool ça
        firstArrayLengthProperty.children[0].value = firstArrayLength + 1;

        this.result = concatenedPropertyReaction.result;
    },

    propagate() {
        this.result.reaction.propagate();
    }
});

ObjectElement.refine({
    reaction: CombineObjectReaction
});
ObjectPropertyElement.refine({
    reaction: CombinePropertyReaction
});
ArrayElement.refine({
    reaction: CombineObjectReaction.extend({
        merge() {
            // combining two array creates an array
            return [];
        }
    })
});
const isPropertyNameValidArrayIndex = (function() {
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
})();

ArrayPropertyElement.refine({
    reaction: DynamicIndexConcatenationReaction,

    isIndex() {
        return isPropertyNameValidArrayIndex(this.name);
    }
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
StringElement.refine({
    reaction: CombineObjectReaction.extend({
        merge(firstString, secondString) {
            return new String(secondString);
        }
    })
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
